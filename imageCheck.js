var AV = require('leanengine');
var util = require('./lib/util');
var http = require('https');
var urlutil=require('url');
var querystring = require('querystring');
var md5 = require('MD5');
var crypto = require('crypto');
var redisClient = require('./redis').redisClient;
var common = require('./common');


var shareImg = AV.Object.extend('shareImg');
var anchorOrder = AV.Object.extend('anchorOrder');
var orderLog = AV.Object.extend('orderLog');
var audioLive = AV.Object.extend('audioLive');
var audioLiveLog = AV.Object.extend('audioLiveLog');
var anchorComment = AV.Object.extend('anchorComment');

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
	var shareID = request.params.shareID;
	saveShareImg(shareID, objectId);
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
	var responseData = "";
	//console.log('发送http请求!');
	var req = http.request(options, function (res) 
	{
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
		responseData += chunk;
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

//下个版本上线之后需要注释
function saveShareImg(shareID, objectId)
{
	console.log('写入图片信息!'+shareID);
	if (shareID && shareID > 0)
	{
		return new AV.Query('shareImg').equalTo('shareID', shareID).find().then(function(results)
		{
			var count = results.length + 1;
			var obj = new shareImg();
			obj.set('shareID', shareID);
			obj.set('imageID', count);
			obj.set('image', AV.File.createWithoutData(objectId));
			obj.set('imgType', 'png');
			return obj.save();

		})
	}
	else
	{
		return;
	}
}
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
});

AV.Cloud.define('createLiveRoom', function(request, response)
{
	var groupID = request.params.groupID;
	var userID = request.params.userID;
	var count = request.params.count;
	var log = new audioLiveLog();
	log.set('des', '创建聊天室');
	return redisClient.incr('createLiveRoom:'+userID, function(err, id) 
	{
		if(err || id > 1)
		{
			return response.error('访问出错!');
		}
		redisClient.expire('createLiveRoom:'+userID, 1);
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
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(data)
		{
			log.set('state', 0);
			if (!data || data.get('Diamond') < 36)
			{
				return AV.Promise.error('钻石不足!');
			}
			log.set('beforeDiamond', data.get('Diamond'));
			data.increment('Diamond', -36);
			data.fetchWhenSave(true);
			return data.save();
		}).then(function(data)
		{
			log.set('state', 1);
			log.set('afterDiamond', data.get('Diamond'));
			var obj = new audioLive();
			obj.set('groupID', groupID);
			obj.set('memberCount', count);
			obj.set('title', request.params.title);
			obj.set('seat', '0,0,0,0,0,0,0,0');
			obj.set('anchor', userID);
			obj.fetchWhenSave(true);
			obj.save();
		}).then(function(data)
		{
			log.set('state', 2);
			log.set('roomID', data.get('roomID'));
			log.save();
			response.success({roomID:data.get('roomID')})
		}).catch(function(error)
		{
			log.set('error', error);
			log.save();
			response.error(error);
		})
	})
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
});

AV.Cloud.define('createAudioOrder', function(request, response)
{
	var userID = request.params.userID;
	var hour = request.params.hour;
	var time = common.stringToDate(request.params.time);
	var anchor = request.params.anchor;
	var price = 0;
	var type = 0;
	var anchorUser = 0;
	var log = new orderLog();
	log.set('des', '下单');
	if (time.getTime() < new Date().getTime() || hour < 1)
	{
		return response.error('时间有误,请选择一个正确的时间!');
	}
	redisClient.incr("createAudioOrder:" + anchor, function(err, id)
	{
		if(id > 1)
		{
			return response.error('访问太过频繁!');
		}
		redisClient.expire('createAudioOrder:' + anchor, 1);
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
			return new AV.Query('anchorRoom').equalTo('anchorID', anchor).first();
		}).then(function(data)
		{
			if (!data)
			{
				return AV.Promise.error('未查到主播信息,请稍后重试!');
			}
			price = data.get('price');
			type = data.get('orderType');
			anchorUser = data.get('userID');
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(data)
		{
			log.set('state', 0);
			if (!data || data.get('cash') < price * hour)
			{
				return AV.Promise.error('余额不足,无法下单!');
			}
			log.set('userID', data.get('userID'));
			log.set('beforeCash', data.get('cash'));
			data.increment('cash', -1 * price * hour);
			data.fetchWhenSave(true);
			return data.save();
		}).then(function(data)
		{
			log.set('state', 1);
			log.set('afterCash', data.get('cash'));

			var obj = new anchorOrder();
			obj.set('anchorUserID', anchorUser);
			obj.set('anchorID', anchor);
			obj.set('userID', userID);
			obj.set('hour', hour);
			obj.set('agreeOn', time);
			obj.set('state', 0);
			obj.set('type', type);
			obj.set('seconds', 0);
			obj.set('price', price*hour);

			obj.fetchWhenSave(true);
			return obj.save();
		}).then(function(data)
		{
			log.set('state', 2);
			log.set('orderID', data.get('orderID'));
			log.save();
			response.success({'cash':price*hour,'orderID':data.get('orderID'), 'userID':anchorUser});
		}).catch(function(error)
		{
			log.save();
			response.error(error);
		})
	});
});

AV.Cloud.define('acceptOrder', function(request, response)
{
	var orderID = request.params.orderID;
	var accept = request.params.accept;
	var userID = request.params.userID;
	var cash = 0;
	var log = new orderLog();
	log.set('des', '取消订单');
	log.set('orderID', orderID);
	redisClient.incr("acceptOrder:" + orderID, function(err, id)
	{
		if(id > 1)
		{
			return response.error('订单状态已经发生改变,请刷新页面!');
		}
		redisClient.expire('acceptOrder:' + orderID, 1);
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
			return new AV.Query('anchorOrder').equalTo('orderID', orderID).first();
		}).then(function(data)
		{
			if (!data || data.get('state') == 2)
			{
				return AV.Promise.error('对话已经结束');
			}
			if (accept == 1)
			{
				if (data.get('state') != 0)
				{
					return AV.Promise.error('状态已经改变!');
				}
				data.set('state', 1);
				return data.save();
			}
			else
			{
				cash = data.get('price');
				if (data.get('state') == 0 || (data.get('state') == 1 && data.get('seconds') < 60))
				{
					if (userID == data.get('anchorUserID'))
					{
						data.set('state', 11);
					}
					else if(userID == data.get('userID'))
					{
						data.set('state', 10);
					}
					else
					{
						return AV.Promise.error('无法取消订单,请稍后再试!');
					}
					data.save();
					return new AV.Query('chatUsers').equalTo('userID', data.get('userID')).first();
				}
				else
				{
					return AV.Promise.error('无法取消订单!');
				}
			}
		}).then(function(data)
		{
			if(accept == 1)
			{
				response.success({cash:0});
				return AV.Promise.error('over');
			}
			else
			{
				if (!data)
				{
					log.set('error', '未查询到用户!');
					log.save();
					return AV.Promise.error('未查询到用户!');
				}
				log.set('userID', data.get('userID'));
				log.set('beforeCash', data.get('cash'));
				data.increment('cash', cash);
				data.fetchWhenSave(true);
				return data.save();
			}
		}).then(function(data)
		{
			log.set('afterCash', data.get('cash'));
			log.save();
			if (userID == data.get('userID'))
			{
				response.success({'cash':cash});
			}
			else
			{
				response.success({'cash':0});
			}
		}).catch(function(error)
		{
			if(error == 'over')
			{
				return ;
			}
			response.error(error);
		})
	})
});

AV.Cloud.define('beginOrder', function(request, response)
{
	var orderID = request.params.orderID;
	var userID = request.params.userID;
	redisClient.incr("beginOrder:" + orderID, function(err, id)
	{
		if(id > 1)
		{
			return response.success({time:3600});
		}
		redisClient.expire('beginOrder:' + orderID, 1);
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
			return new AV.Query('anchorOrder').equalTo('orderID', orderID).first();
		}).then(function(data)
		{
			if (!data)
			{
				return AV.Promise.error('查询失败!');
			}
			if (data.get('userID') != userID && data.get('anchorUserID') != userID)
			{
				return AV.Promise.error('异常!');
			}
			data.set('startTime', new Date());
			data.set('seconds', 1);
			response.success({time:data.get('hour') * 3600});
			return data.save();
		}).catch(function(error)
		{
			response.error(error);
		})
	});
})

AV.Cloud.define('updateCancelOrder', function(request, response)
{
	var orderID = request.params.orderID;
	var userID = request.params.userID;
	var seconds = request.params.seconds;
	redisClient.incr("updateCancelOrder:" + orderID, function(err, id)
	{
		if(id > 1)
		{
			return response.success({time:3600});
		}
		redisClient.expire('updateCancelOrder:' + orderID, 3);
		return new AV.Query('anchorOrder').equalTo('orderID', orderID).first().then(function(data)
		{
			if (!data)
			{
				return AV.Promise.error('未查询到数据');
			}
			if (data.get('userID') != userID && data.get('anchorUserID') != userID)
			{
				return AV.Promise.error('异常!');
			}
			if (data.get('startTime'))
			{
				seconds = parseInt((new Date().getTime() - data.get('startTime').getTime())/1000);
				data.set('seconds', seconds);
			}
			else
			{
				data.set('startTime', new Date());
				data.set('seconds', 5);
			}
			response.success({second:data.get('seconds'), time:data.get('hour') * 3600 - data.get('seconds')});
			return data.save();
		}).catch(function(error)
		{
			response.error(error);
		})
	});
})
AV.Cloud.define('endOrder', function(request, response)
{
	var orderID = request.params.orderID;
	var userID = request.params.userID;
	var seconds = request.params.seconds;
	var anchorID = 0;
	var price = 0;
	var log = new orderLog();
	log.set('des', '结束订单');
	log.set('orderID', orderID);
	redisClient.incr("updateCancelOrder:" + orderID, function(err, id)
	{
		if(id > 1)
		{
			return response.success({time:3600});
		}
		redisClient.expire('updateCancelOrder:' + orderID, 3);
		return new AV.Query('anchorOrder').equalTo('orderID', orderID).first().then(function(data)
		{
			if (!data || data.get('state') != 1)
			{
				return AV.Promise.error('未查询到订单数据!');
			}
			if (data.get('userID') != userID && data.get('anchorUserID') != userID)
			{
				return AV.Promise.error('异常!');
			}
			var startTime = data.get('startTime');
			//如果是支付方式可以随时结束订单
			if (userID != data.get('userID'))
			{
				if (!startTime && data.get('seconds') < 3600)
				{
					return AV.Promise.error('未到时间!');
				}
				if ((startTime.getTime - new Date().getTime())/1000 < data.get('hour') * 3600 
					&& data.get('seconds') < data.get('hour')*3600 )
				{
					return AV.Promise.error('未到时间!');
				}
			}
			data.set('state', 2);
			data.set('endTime', new Date());

			price = data.get('price');
			anchorID = data.get('anchorUserID');
			data.save();
			return new AV.Query('chatUsers').equalTo('userID', anchorID).first();
		}).then(function(data)
		{
			log.set('beforeCash', data.get('cash'));
			log.set('userID', data.get('userID'));
			data.increment('cash', price/2);
			data.fetchWhenSave(true);
			data.save();
		}).then(function(data)
		{
			log.set('afterCash', data.get('cash'));
			log.save();
			response.success('');
		}).catch(function(error)
		{
			return response.error(error);
		})
	});
});

AV.Cloud.define('commentOrder', function(request, response)
{
	var orderID = request.params.orderID;
	var star = request.params.star;
	var userID = request.params.userID;
	var comment = request.params.comment || '';
	var cash = 0;
	var anchor = 0;
	var log = new orderLog();
	log.set('des', '评价');
	log.set('orderID', orderID);
	log.set('star', star);
	redisClient.incr("commentOrder:" + orderID, function(err, id)
	{
		if(id > 1)
		{
			return response.error('订单状态已经发生改变,请刷新页面!');
		}
		redisClient.expire('commentOrder:' + orderID, 10);

		var saveObjs = new Array();
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
			return new AV.Query('anchorComment').equalTo('orderID', orderID).first();
		}).then(function(data)
		{
			if (data)
			{
				return AV.Promise.error('该订单已经评论过了');
			}
			return new AV.Query('anchorOrder').equalTo('orderID', orderID).first();
		}).then(function(data)
		{
			if (!data || data.get('userID') != userID || data.get('state') != 2)
			{
				return AV.Promise.error('查询订单失败!');
			}
			data.set('state', 3);
			data.set('star', star);
			cash = data.get('price') *(star - 1)/ 10;
			anchor = data.get('anchorID');
			return data.save();
		}).then(function(data)
		{
			log.set('state', 0);
			return new AV.Query('anchorRoom').equalTo('anchorID', anchor).first();
		}).then(function(data)
		{
			if(!data)
			{
				return AV.Promise.error('未查询到主播信息!');
			}
			var nCount = data.get('commentCount');
			var oldStar = data.get('scole');
			data.set('scole', (oldStar*nCount + star) / (nCount+1));
			data.increment('commentCount', 1);
			data.save();
			return new AV.Query('chatUsers').equalTo('userID', data.get('userID')).first();
		}).then(function(data)
		{
			log.set('state', 1);
			if(!data)
			{
				return AV.Promise.error('未查到用户信息!');
			}
			log.set('beforeCash', data.get('cash'));
			if (cash > 0)
			{
				data.increment("cash", cash);
			}
			data.fetchWhenSave(true);
			return data.save();
		}).then(function(data)
		{
			log.set('afterCash', data.get('cash'));
			log.save();
			var obj = new anchorComment();
			obj.set('orderID', orderID);
			obj.set('anchorID', anchor);
			obj.set('userID', userID);
			obj.set('star', star);
			obj.set('comment', comment);
			obj.save();
			response.success('');
		}).catch(function(error)
		{
			log.save();
			response.error(error);
		});
	});
});

AV.Cloud.define('askForOrder', function(request, response)
{
	var userID = request.params.userID;
	var type = request.params.type;
	var diamond = request.params.diamond || 0;
	var key = 'askOrder:' + userID;
	var vip = 0;
	var log = new global.moneyLog();
	log.set('des', '钻石求订单');
	redisClient.incr(key, function(err, id)
	{
		if(id > 1)
		{
			return response.error('订单状态已经发生改变,请刷新页面!');
		}
		redisClient.expire(key, 3000);
		return new AV.Query('chatUsers').equalTo('userID', userID).first().then(function(data)
		{
			if (!data)
			{
				return AV.Promise.error('查询用户信息失败!');
			}
			vip = common.getVipType(data.get('BonusPoint'));
			if (common.stringToDate(data.get('VIPDay')).getTime() < new Date().getTime())
			{
				vip = 0;
			}
			if (diamond == 1 && data.get('Diamond') < 10)
			{
				return AV.Promise.error('钻石不足!');
			}
			log.set('userid', userID);
			log.set('diamondBefore', data.get('Diamond'));
			data.increment('Diamond', diamond);
			data.fetchWhenSave(true);
			return data.save();
		}).then(function(data)
		{
			log.set('diamondAfter', data.get('Diamond'));
			return new AV.Query('anchorRoom').equalTo('userID', userID).equalTo('orderType', type).first();
		}).then(function(data)
		{
			if(!data)
			{
				return AV.Promise.error('查询主播信息失败!');
			}
			data.set('upTime', new Date());
			data.set('newPoint', 6 + vip + diamond);
			data.save();
		}).then(function(success){
			log.set('result', 'ok');
			log.save();
			response.success();
		}).catch(function(error)
		{
			log.set('result', error);
			log.save();
			response.error(error);
			redisClient.expire(key, 3);
		});
	});
});

AV.Cloud.define('updateAskForOrder', function(request, response)
{
	var anchors = request.params.anchors;
	var key = 'updateAskForOrder';
	redisClient.incr(key, function(err, id)
	{
		if(id > 1)
		{
			return response.error('订单状态已经发生改变,请刷新页面!');
		}
		redisClient.expire(key, 60);
		return new AV.Query('anchorRoom').containedIn('anchorID', anchors).find().then(function(results)
		{
			for (var i = results.length - 1; i >= 0; i--) {
				var data = results[i];
				var second = (data.get('upTime').getTime() - new Date().getTime())/300000;
				data.increment('newPoint', parseInt(-1 * second));
			}
			return AV.Object.saveAll(results);
		}).then(function(success)
		{
			return response.success('');
		}).catch(function(error)
		{
			return response.error(error);
		});
	});

})

module.exports = AV.Cloud;