var AV = require('leanengine');
var util = require('./lib/util');
var http = require('https');
var urlutil=require('url');
var querystring = require('querystring');
var md5 = require('MD5');
var crypto = require('crypto');
var redisClient = require('./redis').redisClient;
var common = require('./common');

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
	var appkey = '457df59253dc5233cd34d1642cefd742';
	var appSecret = '2e4575f65998';
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

AV.Cloud.define('setActor', function(request, response)
{
	var roomID = request.params.roomID;
	var userID = request.params.userID;
	var mute = request.params.mute;
	var seat = request.params.seat;
	var groupID = '';

	if (seat < 0 || seat >= 8)
	{
			return response.error('参数错误!');
	}
	redisClient.incr('Actor:' + roomID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问太过频繁!');
		}
		redisClient.expire('Actor:' + roomID, 1);

		new AV.Query('audioLive').equalTo('roomID', roomID).first().then(function(data)
		{
			if(!data)
			{
				return AV.Promise.error('没查询到数据!');
			}
			var seats = data.get('seat').split(',');
			groupID = data.get('groupID');

			for (var i = seats.length - 1; i >= 0; i--) 
			{
				if (i == seat)
				{
					if (mute == 0 )
					{
						if (seats[i] == userID)
						{
							seats[i] = 0;
						}
						else
						{
							return AV.Promise.error('下麦失败!');
						}
					}
					else if(mute == 1)
					{
						if (seats[i] == 0)
						{
							seats[i] = userID;
						}
						else
						{
							return AV.Promise.error('上麦失败!');
						}
					}
					else if (mute == 2)
					{
						if (seats[i] >= 0)
						{
							return AV.Promise.error('解封失败,该座位并非被封禁!');
						}
						else
						{
							seats[i] = 0;
						}
					}
					else if (mute == 4)
					{
						if (seats[i] >= 0)
						{
							seats[i] = -1;
						}
						else
						{
							return AV.Promise.error('该座位已经被封禁了!');
						}
					}
					else if (mute == 5 || mute == 6)//强制踢人,强制下麦
					{
						if (seats[i] > 0)
						{
							seats[i] = 0;
						}
						else
						{
							return AV.Promise.error('该座位没有人!');
						}
					}
				}
			}
			data.set('seat', seats.join(','));
			return data.save();
		}).then(function(success)
		{
			response.success(groupID);
		}).catch(function(error)
		{
			response.error(error);
		});
	});
})

AV.Cloud.define('liveRoomChangeTheme', function(request, response)
{
	var roomID = request.params.roomID;
	var userID = request.params.userID;
	var theme = request.params.theme;
	var groupID = '';

	redisClient.incr('liveRoomTheme:' + roomID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问太过频繁!');
		}
		redisClient.expire('liveRoomTheme:' + roomID, 1);

		new AV.Query('audioLive').equalTo('roomID', roomID).first().then(function(data)
		{
			if(!data)
			{
				return AV.Promise.error('没查询到数据!');
			}
			if (data.get('anchor') != userID)
			{
				return AV.Promise.error('你不是房主,无法更换主题背景!');
			}
			data.set('theme', theme);
			groupID = data.get('groupID');
			return data.save();
		}).then(function(success)
		{
			response.success(groupID);
		}).catch(response.error);
	});
})

AV.Cloud.define('closeRoom', function(request, response)
{
	var roomID = request.params.roomID;
	var userID = request.params.userID;
	var groupID = '';
	return redisClient.getAsync('token:' + userID).then(function(cache)
	{	
		if(!cache || cache != request.params.token)
		{
			//评价人的令牌与userid不一致
			if (global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
		}
	return new AV.Query('audioLive').equalTo('roomID', roomID).first();
	}).then(function(data)
	{
		if(data.get('anchor') != userID)
		{
			return AV.Promise.error('你不是房主,无法关闭房间!');
		}
		groupID = data.get('groupID');
		return data.destroy();
	}).then(function(success)
	{
		response.success(groupID);
	}).catch(function(error)
	{
		response.error(error);
	});
})

AV.Cloud.define('joinLiveRoom', function(request, response){
	var userID = request.params.userID;
	var roomID = request.params.roomID;
	var key = "joinLiveRoom:"+ roomID+ '-' + userID;
	redisClient.incr(key, function(err, id)
	{
		if (err || id > 1)
		{
			return response.error('已经处理了!');
		}
		redisClient.expire(key, 3);
		redisClient.getAsync('liveRoomUser:' + roomID).then(function(cache)
		{
			var users = new Array();
			if (cache)
			{
				users = cache.split(',');
				for (var i = users.length - 1; i >= 0; i--) {
					if( users[i] == userID)
					{
						return response.error('已经存在了');
					}
				}
			}
			users.push(userID);
			console.log(users);
			redisClient.setAsync('liveRoomUser:'+roomID, users.join(','));
		}).catch(function(error)
		{
			console.log(error);
			response.error('error');
		})
	});
});

AV.Cloud.define('leaveLiveRoom', function(request, response){
	var userID = request.params.userID;
	var roomID = request.params.roomID;
	var key ="leaveLiveRoom:"+ roomID +'-' + userID;
	redisClient.incr(key, function(err, id)
	{
		if (err || id > 1)
		{
			return response.error('已经处理了!');
		}
		redisClient.expire(key, 3);
		redisClient.getAsync('liveRoomUser:' + roomID).then(function(cache)
		{
			var users = new Array();
			if (cache)
			{
				users = cache.split(',');
				for (var i = users.length - 1; i >= 0; i--) {
					if( users[i] == userID)
					{
						users.splice(i, 1);
					}
				}
			}
			else
			{
				return response.error('error');
			}
			redisClient.setAsync('liveRoomUser:'+roomID, users.join(','));
		}).catch(function(error)
		{
			response.error('error');
		})
	});
});

AV.Cloud.define('liveRoomOnline', function(request, response)
{
	var roomID = request.params.roomID;
	redisClient.getAsync('liveRoomUser:' + roomID).then(function(cache)
	{
		if(!cache)
		{
			return response.success(0);
		}
		else
		{
			var users = cache.split(',');
			return response.success(users.length);
		}
	}).catch(function(error)
	{
		response.success(0);
	});
})

AV.Cloud.define('liveRoomSendGift', function(request, response)
{
	var userID = request.params.userID;
	var otherID = request.params.otherID;
	var roomID = request.params.roomID;
	var groupID = '';
	var gift = common.getLiveRoomGift(request.params.giftID);
	if (!gift || gift.gold <= 0)
	{
		return response.error('查询失败!');
	}

	return redisClient.incr('liveRoomSendGift:'+userID, function(err, id) 
	{
		if(err || id > 1)
		{
			return response.error('访问出错!');
		}
		redisClient.expire('liveRoomSendGift:'+userID, 1);
		return redisClient.getAsync('token:' + userID).then(function(cache)
		{	
			if(!cache || cache != request.params.token)
			{
				//评价人的令牌与userid不一致
				if (global.isReview == 0)
				{
					return AV.Promise.error('访问失败!');
				}
			}
			return new AV.Query('chatUsers').containedIn('userID', [userID, otherID]).find();
		}).then(function(results)
		{
			if(results.length != 2)
			{
				return AV.Promise.error('获取用户信息失败!');
			}
			for (var i = results.length - 1; i >= 0; i--) {
				var data = results[i];
				if (data.get('userID') == userID)
				{
					if (data.get('goldNum') < gift.gold)
					{
						return AV.Promise.error('金币不足!');
					}
					data.increment('goldNum', -1*gift.gold);
					data.increment('useGold', gift.gold);
					if(data.get('dailyUseGoldAt') && common.checkDaySame(new Date(), data.get('dailyUseGoldAt')))
					{
						data.increment('dailyUseGold', gift.gold);
					}
					else{
						data.set('dailyUseGold', gift.gold);
					}
					data.set('dailyUseGoldAt', new Date());

				}
				else
				{
					data.increment('beLikedNum', gift.charm);
				//日魅力增加
					if(data.get('dailylikeAt') && common.checkDaySame(data.get('dailylikeAt'), new Date()))//同一天,直接增加日魅力
					{
						data.increment('dailylike', gift.charm);
					}
					else
					{
						data.set('dailylike', gift.charm);
					}
					data.set('dailylikeAt', new Date());
				}

			}
			return AV.Object.saveAll(results);
		}).then(function(success)
		{
			response.success('success');
		}).catch(function(error)
		{
			response.error(error);
		})
	});
})
module.exports = AV.Cloud;