var AV = require('leanengine');
var util = require('./lib/util');
var http = require('https');
var urlutil=require('url');
var querystring = require('querystring');
var md5 = require('MD5');
var crypto = require('crypto');

//产品密钥ID，产品标识 
var secretId = "5c05f160dbb2ada14bdd2dadf158edc3";
// 产品私有密钥，服务端生成签名信息使用，请严格保管，避免泄露 
var secretKey = "9d586e5017de13ab7f2d09114acd34d2";
// 业务ID，易盾根据产品业务特点分配 
var businessId = "3455a9b819c343998cecef3a849e447f";
// 易盾反垃圾云服务图片在线检测接口地址 
var apiurl = "https://api.aq.163.com/v2/image/check";


function sign(param)
{
	var query = Object.keys(param).sort();
	var realstring='';
	for(var key in query)
	{
		realstring += query[key] +param[query[key]];
		//console.log(realstring);
	}
	realstring += secretKey;
	var md5er = crypto.createHash('md5');//MD5加密工具
	md5er.update(realstring,"UTF-8");
	return md5er.digest('hex');
}

AV.Cloud.define('checkSexImage', function(request, response)
{
	var url = request.params.url;
	var objectId = request.params.objectId;

	//请求参数
	var post_data = {
		// 1.设置公有有参数
		secretId:secretId,
		businessId:businessId,
		version:"v2",
		timestamp:new Date().getTime(),
		nonce:util.generateNonceString(),
		// 2.1设置私有参数
		account:"nodejs@163.com",
		ip:"123.59.47.48"
	};
	post_data.images = JSON.stringify([{name:url,type:1,data:url}]);
	var signature = sign(post_data);
	post_data.signature = signature;

	//发送http请求
	var content = querystring.stringify(post_data,null,null,null);
	var urlObj = urlutil.parse(apiurl);
	var host = urlObj.hostname;
	var path = urlObj.path;
	var port = urlObj.port;
	var options = {
		hostname: host,
		port: port,
		path: path,
		method: "POST",
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
			'Content-Length': Buffer.byteLength(content)
			}
	};
	var responseData="";
	//console.log('发送http请求!');
	var req = http.request(options, function (res) 
	{
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
		responseData+=chunk;
		});
		res.on('end', function () 
		{
		    var data = JSON.parse(responseData);
			var code = data.code;
			var msg = data.msg;
			if(code == 200)
			{
				var result = data.result;
				if(result.length == 0)
				{
					response.error('error');
				}else
				{
					for(var i=0;i<result.length;i++)
					{
						var obj=result[i];
						var name=obj.name;
						//console.log("name="+name);
						var labelsArray=obj.labels;
						for(var k=0;k<labelsArray.length;k++)
						{
							var labelObj=labelsArray[k];
							var label = labelObj.label;
							var level = labelObj.level;
							var rate = labelObj.rate;
							//console.log("lable:"+label+",level:"+level+",rate:"+rate);
							if(level == 2)//确定是违禁图片
							{
								response.success('色情图片!');
								var file = AV.File.createWithoutData(objectId);
  								return file.destroy().catch(console.error);
							}
							else
							{
								return response.error('error');
							}
						}
				
					}
				}
			}
			else
			{
		 		console.log('ERROR:code=' + code+',msg='+msg);
		 		return response.error('error');
			}
		});
		    //设置超时
		req.setTimeout(10000,function(){
		   	console.log('request timeout!');
		   	
		    req.abort();
		    return response.error('访问超时!');
		});
		req.on('error', function (e) {
		    console.log('request ERROR: ' + e.message);
		    return response.error(e.message);
		});
	});
	req.write(content);
	req.end();
});
function SHA1(appkey, nonce, curtime)
{
	var data = appkey+nonce+curtime;
	var hash = crypto.createHash('sha1');
	hash.update(data);
	return getFormattedText(hash.digest());

}
var HEX_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f' ];
function getFormattedText(bytes) {
    var len = bytes.length;
    var buf = new Array();
    for (var j = 0; j < len; j++) {
        buf.push(HEX_DIGITS[(bytes[j] >> 4) & 0x0f]);
        buf.push(HEX_DIGITS[bytes[j] & 0x0f]);
    }
    return buf.join('');
}
AV.Cloud.define('yunxinLogIn', function(request, response)
{
	var timestamp = parseInt(new Date().getTime()/1000).toString();
	var nonce = util.generateNonceString();
	var appkey = '89066567011f783f02ae90c5a588a899';
	var appSecret = '57af5474be15';
	var urlObj = urlutil.parse('https://api.netease.im/nimserver/user/create.action');
	//拉取token
	if(request.params.account)
	{
		urlObj = urlutil.parse('https://api.netease.im/nimserver/user/refreshToken.action');
		var host = urlObj.hostname;
		var path = urlObj.path;
		var port = urlObj.port;
	}
	else//新用户注册
	{
		var host = urlObj.hostname;
		var path = urlObj.path;
		var port = urlObj.port;
	}
	var options =
	{
		hostname: host,
		port: port,
		path: path,
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
			AppKey:appkey,
			Nonce:nonce,
			CurTime:timestamp,
			CheckSum:SHA1(appSecret, nonce, timestamp)
		}
	}
	var responseData='';
	var content = querystring.stringify({accid:request.params.userID.toString()},null,null,null);
	var responseData='';
	var content = querystring.stringify({accid:request.params.userID.toString()},null,null,null);
	var req = http.request(options, function (res) 
	{
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			responseData+=chunk;
		});
		res.on('end', function () 
		{
			console.log(responseData);
		    var data = JSON.parse(responseData);
			var code = data.code;
			var msg = data.msg;
			if(code == 200)
			{
				var result = data.info;
				response.success(result);
			}
			else
			{
				response.error(data.desc);
			}
		});
		req.setTimeout(10000,function(){
		   	console.log('request timeout!');
		    req.abort();
		});
		req.on('error', function (e) {
		    console.log('request ERROR: ' + e.message);
		});
	});
	req.write(content);
	req.end();
});


module.exports = AV.Cloud;