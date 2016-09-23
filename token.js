var AV = require('leanengine');
var redisClient = require('./redis').redisClient;
var common = require('./common');
var chatUsers = AV.Object.extend('chatUsers');
var userLog = AV.Object.extend('userLog');

AV.Cloud.define('LogInUserByPhone', function(request, response)
{
	
	var phoneNumber = request.params.phoneNumber;
	var enCodePhone = request.params.encodePhone;
	var passwd = request.params.passwd;
	var md5pwd = request.params.md5pwd;
	var userID = -1;

	
	var query1 = new AV.Query('chatUsers');
	query1.equalTo('MobilePhone', phoneNumber);

	var query2 = new AV.Query('chatUsers');
	query2.equalTo('MobilePhone', enCodePhone);

	return AV.Query.or(query1, query2).first().then(function(data)
	{
		if(!data)
		{
			return AV.Promise.error('未查询到对应账号!');
		}
		if(data.get('Passwd') != passwd && data.get('Passwd') != md5pwd)
		{
			return AV.Promise.error('密码错误');
		}
		userID = data.get('userID');

		return redisClient.incr('tokenCount:'+userID);
	}).then(function(err, id)
	{
		console.log("token访问次数" +err+ id);
		return redisClient.getAsync('token:' + userID);
	}).then(function(cache)
	{
		console.log("获取cache");
		if(cache)
		{
			response.success({'token':cache, 'userID':userID});
		}
		else
		{
			var token = common.createToken();
			redisClient.setAsync('token:'+userID, token);
			redisClient.setAsync(token, userID.toString());
			response.success({'token':token, 'userID':userID});
		}
		redisClient.expire(token, 86400);
		redisClient.expire('token:' + userID, 86400);
		
	}).catch(function(error)
	{
		return response.error(error);
	});
});

AV.Cloud.define('LogInUserByWeChat', function(request, response)
{
	var openid = request.params.openid;
	var userID = -1;
	var query = new AV.Query('chatUsers');
	query.equalTo('openid',openid);
	return query.first().then(function(data)
	{
		if(!data)
		{
			var obj = new chatUsers();
			obj.set('sex', 1);
			obj.set('userLabels', '3');
			obj.set('receiveType', 3);
			obj.set('bAlreadyComment', 0);
			obj.set('bAlreadyYQ', 0);
			obj.set('bSexSetable', 1);
			obj.set('petReword', 10);
			obj.set('myState', -1);
			obj.set('openid', openid);
			obj.fetchWhenSave(true);
			return obj.save();
		}
		userID = data.get('userID');
		return AV.Promise.as('success');
	}).then(function(data)
	{
		if(userID != -1)
		{
			return redisClient.getAsync('token:' + userID);
		}
		else
		{
			userID = data.get('userID');
			return redisClient.getAsync('token:' + userID);
		}
	}).then(function(cache)
	{
		if(cache)
		{
			response.success({'token':cache, 'userID':userID});
		}
		else
		{
			var token = common.createToken();
			redisClient.setAsync('token:'+userID, token);
			redisClient.setAsync(token, userID.toString());
			response.success({'token':token, 'userID':userID});
		}
		redisClient.expire(token, 86400);
		redisClient.expire('token:' + userID, 86400);
	}).catch(function(error)
	{
		return response.error(error);
	})
});

AV.Cloud.define('LogInByToken', function(request, response)
{
	var token = request.params.token;
	redisClient.getAsync(token).then(function(cache)
	{
		if(cache)//得到用户,返回
		{
			redisClient.expire(token, 86400);
			redisClient.expire('token'+cache, 86400);

			response.success(parseInt(cache));
		}
		else
		{
			response.error('本地登录已经过期,请重新输入账户密码!');
		}
	}).catch(function(error)
	{
		response.error('未知错误!');
	});
});

AV.Cloud.define('checkPhoneUse', function(request, response)
{
	var phoneNumber = request.params.phoneNumber;
	var enCodePhone = request.params.encodePhone;
	var query1 = new AV.Query('chatUsers');
	query1.equalTo('MobilePhone', phoneNumber);

	var query2 = new AV.Query('chatUsers');
	query2.equalTo('MobilePhone', enCodePhone);

	return AV.Query.or(query1, query2).first().then(function(data)
	{
		if(data)
		{
			return AV.Promise.error('该号码已经被注册了');
		}
		return AV.Cloud.requestSmsCode({mobilePhoneNumber: phoneNumber,name: '有朋',op: '短信验证',ttl:10});
	}).then(function(success){
		response.success('');
	}).catch(function(error)
	{
		response.error(error);
	});
});

AV.Cloud.define('checkPhoneVerify', function(request, response)
{
	var phoneNumber = request.params.phoneNumber;
	var encodePhone = request.params.encodePhone;
	var passwd = request.params.passwd;
	var code = request.params.code;
	var type = request.params.type;
	var userID = -1;
	redisClient.incr('phone:'+phoneNumber, function(err, id){
		redisClient.expire('phone:'+phoneNumber, 2);
		if(id > 1)
		{
			return response.error('访问太过频繁!');
		}
		if(type != 1 && type != 2)
		{
			return response.error('无法识别的操作!');
		}
		console.log(code);
		return AV.Cloud.verifySmsCode(code, phoneNumber).then(function(success)
		{

			//注册账号
			if(type == 1)
			{
				var obj = new chatUsers();
				obj.set('sex', 1);
				obj.set('userLabels', '3');
				obj.set('receiveType', 3);
				obj.set('bAlreadyComment', 0);
				obj.set('bAlreadyYQ', 0);
				obj.set('bSexSetable', 1);
				obj.set('petReword', 10);
				obj.set('myState', -1);
				obj.set('MobilePhone', encodePhone);
				obj.fetchWhenSave(true);
				return obj.save();
			}
			else
			{
				var query1 = new AV.Query('chatUsers');
				query1.equalTo('MobilePhone', phoneNumber);

				var query2 = new AV.Query('chatUsers');
				query2.equalTo('MobilePhone', encodePhone);

				return AV.Query.or(query1, query2).first();
			}
		}).then(function(data){
			if(!data)
			{
				return AV.Promise.error('数据库出错!');
			}
			data.set('Passwd', passwd);
			data.save();
			//注册账号 或是修改密码之后 需要一个新的token
			userID = data.get('userID');
			return redisClient.getAsync('token:'+userID);
			
		}).then(function(cache){
			var token = common.createToken();
			if(cache)
			{
				redisClient.delAsync(cache);
			}

			redisClient.setAsync('token:'+userID, token);
			redisClient.setAsync(token, userID);
			redisClient.expire(token, 86400);
			redisClient.expire('token' + userID, 86400);

			response.success('');
		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

//chatUsers表相关
AV.Cloud.define('updateUserInfo', function(request, response)
{
	var userID = request.params.userID;
	var fields = request.params.field;
	var values = request.params.value;
	for (var i = fields.length - 1; i >= 0; i--) {
		if(fields[i] == 'goldNum' || fields[i] == 'goldMax' || fields[i] == 'Diamond' ||
			fields[i] == 'Passwd' || fields[i] == 'BonusPoint' || fields[i] == 'MobilePhone'||
			fields[i] == 'userID' || fields[i] == 'lastQDtime')
		{
			return response.error('数据异常!');
		}
	}
	return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
	{	
		if(!cache || cache != request.params.token)
		{
			if (global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
		}
		return new AV.Query('chatUsers').equalTo('userID', userID).first();
	}).then(function(data)
	{
		for (var i = fields.length - 1; i >= 0; i--) 
		{
			if(fields[i] == 'location')
			{
				var point = JSON.parse(values[i]);
				if(point.lat == 0 && point.long == 0)
				{
					data.set('location', new AV.GeoPoint(null));
				}
				else
				{
					data.set('location', new AV.GeoPoint(point));
				}
			}
			else
			{	
				data.set(fields[i], values[i]);
			}
		}
		return data.save();
	}).then(function(success)
	{
		response.success('');
	}).catch(function(error)
	{
		return response.error('修改失败!');
	});
});

AV.Cloud.define('upOnlineTime', function(request, response)
{
	return new AV.Query('chatUsers').equalTo('userID', request.params.userID).first().then(function(data)
	{
		if(request.params.userID == 42)
		{
			var obj = new userLog();
			obj.set('userid', 42);
			obj.set('time', new Date());
			obj.set('des', '登录');
			obj.save();
		}
		if(data)
		{
			var now = new Date();
			data.set('launchTime', now);
			data.set('onlineTime', now);
			var gag =[];
			if(data.get('GagDate'))
			{
				data.get('GagDate').split('-');
			} 
			if(gag.length == 3)
			{
				if(parseInt(gag[0]) <= now.getFullYear() && parseInt(gag[1]) <= now.getMonth()+1 && parseInt(gag[2]) <= now.getDate())
				{
					return response.success({gag:1});
				}
			}

			return response.success({gag:0});
		}
		return response.success({gag:0});
	}).catch(function(error)
	{
		return response.success({gag:0});
	});
});

AV.Cloud.define('PraiseAndBad', function(request, response)
{
	var fromID = request.params.fromID;	
	var userID = request.params.userID;
	var type = request.params.type;
	var mutiple = request.params.mutiple;
	var token = request.params.token;
	//参数判断
	if(type == 1)
	{
		mutiple = 1;
	}
	else
	{
		if(!mutiple)
		{
			mutiple = 1;
		}
		if(mutiple > 16)
		{
			mutiple = 16;
		}
	}
	var date = new Date();
	var resData ={};
	var userRate = {};
	redisClient.incr("Praise:"+fromID, function(err, id)
	{
		if(id > 1)
		{
			return response.error('访问太过频繁!');
		}
		redisClient.expire('Praise:'+fromID, 1);
		return redisClient.getAsync('token:' + fromID).then(function(cache)
		{	
			if(!cache || cache != request.params.token)
			{
				//评价人的令牌与userid不一致
				if (global.isReview == 0)
				{
					return AV.Promise.error('访问失败!');
				}
			}
			return redisClient.getAsync('Rated:'+ fromID);
		}).then(function(cache)
		{
			var rate = {};
			if(cache)
			{
				rate = JSON.parse(fromID);
				
				if(!common.checkDaySame(date, rate.date))
				{
					rate.count = 10;
					rate.date = new Date();
					rate.user = [];
				}
			}
			else
			{
				rate.count = 10;
				rate.date = new Date();
				rate.user = [];
			}
			if(rate.count <= 0)
			{
				return AV.Promise.error('可评价次数不足');
			}
			rate.count -= 1;
			redisClient.setAsync('Rated:'+ fromID, JSON.stringify(rate));
			return redisClient.getAsync('Rated'+ userID);
		}).then(function(cache)
		{
			if(cache)
			{
				userRate = JSON.parse(cache);
				if(!common.checkDaySame(date, userRate.date))
				{
					userRate.count = 10;
					userRate.date = new Date();
					userRate.user = [];
				}
			}
			else
			{
				userRate.count = 10;
				userRate.date = new Date();
				userRate.user = [];
			}
			for (var i = userRate.user.length - 1; i >= 0; i--) {
				if(userRate.user[i] == fromID)
				{
					return AV.Promise.error('你今天已经评价过他(她)了!');
				}
			}
			userRate.user.push(fromID);
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(data)
		{
			if(type == 1)//加好评
			{
				var gold = common.getGoodReview(data.get('greatNum'));
				resData = gold;
				data.increment('greatNum', 1);
				if(data.get('dailygoodAt') && common.checkDaySame(data.get('dailygoodAt'), date))
				{
					data.increment('dailygood', 1);
				}
				else
				{
					data.set('dailygood', 1);
				}
				data.set('dailygoodAt', date);
				data.increment('goldNum', gold.goldNum);
				if(gold.goldMax && gold.goldMax > 0)
				{
					data.increment('goldMax', gold.goldMax);
				}
				return data.save();
			}
			else
			{
				var gold = common.getBadReview(data.get('badNum'));
				resData = gold;
				data.increment('badNum', 1);
				data.increment('goldNum', gold.goldNum * mutiple);
				return data.save();
			}
		}).then(function(success)
		{
			if(mutiple == 1 || type == 1)
			{
				return AV.Promise.error('over');
			}
			return AV.Query('chatUsers').equalTo('userID', fromID).first();
		}).then(function(data)
		{
			data.increment('goldNum', parseInt(resData.goldNum * mutiple *0.5));
			return data.save();
		}).then(function(success)
		{
			redisClient.setAsync('Rated:'+userID, JSON.stringify(userRate));
			response.success(resData);
		}).catch(function(error)
		{
			if(error=='over')
			{
				response.success(resData);
			}
			else
			{
				response.error(error);
			}
		});
	});
});

AV.Cloud.define('startChat', function(request, response)
{
	var userID = request.params.userID;
	var otherID = request.params.otherID;
	var needGold = 0;
	if(userID == otherID)
	{
		return response.error('无法向自己发起对话!');
	}
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
		return new AV.Query('chatUsers').equalTo('userID', otherID).first();
	}).then(function(data)
	{
		if(!data || data.get('myState') == 1)
		{
			return AV.Promise.error('发起对话失败!');
		}
		if(data.get('myState') == 3)
		{
			return AV.Promise.error('success');
		}
		needGold = data.get('startChatGold');

		var query1 = new AV.Query('chatUsers').equalTo('userID', otherID);
		var query2 = new AV.Query('chatUsers').equalTo('userID', userID);
		return AV.Query.or(query1, query2).find();
	}).then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			if(data.get('userID') == userID)
			{
				if(data.get('goldNum') < needGold)
				{
					return AV.Promise.error('金币不足,无法发起聊天!');
				}
				data.increment('goldNum', -1 * needGold);
			}
			else if(data.get('userID') == otherID)
			{
				data.increment('goldNum', needGold);
			}
		}
		return AV.Object.saveAll(results);
	}).then(function(success)
	{
		response.success({'gold': needGold});
	}).catch(function(error)
	{
		if(error == 'success')
		{
			return response.success({'gold':0});
		}
		return response.error(error);
	});
});

AV.Cloud.define('shareLike', function(request, response)
{
	var userID = request.params.userID;
	var shareID = request.params.shareID;
	var goldMax = 0;
	var goldEach = 0;

	return redisClient.incr('shareLike:'+shareID,function(err, id) 
	{
		if(err || id > 1)
		{
			return response.error('访问太过频繁!');
		}
		redisClient.expire(key, 1);
		
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
			return new AV.Query('shareInfoTable').equalTo('shareID', shareID).first();
		}).then(function(data)
		{
			if(!data)
			{
				return AV.Promise.error('查询失败!');
			}
			data.increment('beLikedCount', 1);
			goldMax = data.get('goldSendRest');
			goldEach = data.get('goldGetEach');
			if(goldEach > 100)
			{
				goldEach = 100;
			}
			if(goldMax < goldEach)
			{
				return AV.Promise.error('已经领完了!');
			}
			data.increment('goldSendRest', -1 * goldEach);
			return data.save();
		}).then(function(success)
		{
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(data)
		{
			data.increment('goldNum', goldEach);
			return data.save();
		}).then(function(success)
		{
			response.success({'gold':goldEach});
		}).catch(function(error)
		{
			response.error(error);
		});
	});
})

AV.Cloud.define('increaseGold', function(request, response)
{
	var userID = request.params.userID;
	var tag = request.params.tag;
	var value = request.params.value;
	var gold = 0;
	var goldMax = 0;
	var vip =[15, 30, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300];
	var key = 'increaseType'+tag+":" +userID;
	redisClient.incr(key, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('失败!');
		}
		if(tag == 10)
		{
			redisClient.expire(key, 50);
		}
		else
		{
			redisClient.expire(key, 1);
		}

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
		if(tag == 1)
		{
			return new AV.Query('shareInfoTable').equalTo('shareID', value).first();
		}
		else
		{
			return AV.Promise.as('success');
		}

	}).then(function(data)
	{
		if(tag == 1)
		{
			gold = -1 * data.get('goldSendRest');
		}
		else if(tag == 2)
		{
			gold = -100;
		}
		else if(tag == 3)
		{
			gold = -1000;
		}
		else if(tag == 4)
		{
			gold = -100;
		}
		else if(tag == 5)
		{
			gold = 100;
		}
		else if(tag == 6)
		{
			gold = 100;
			goldMax = 100;
		}
		else if(tag == 7)
		{
			gold = -10;
		}
		else if(tag == 8)
		{
			gold = -20;
		}
		else if(tag == 9)
		{
			gold = -2000;
		}
		else if(tag == 11)
		{
			gold = 200;
		}
		else if(tag == 12)
		{
			gold = 100;
		}
		else if(tag == 13)
		{
			gold = 50;
		}
		return new AV.Query('chatUsers').equalTo('userID', userID).first();
	}).then(function(data)
	{
		if(tag == 2 && data.get('sex') == 2)
		{
			gold = -50;
		}
		if(tag == 10)
		{
			gold = vip[common.getVipType(data.get('BonusPoint'))];
		}
		data.increment('goldNum', gold);
		if(goldMax > 0)
		{
			data.increment('goldMax', goldMax);
		}
		return data.save();
	}).then(function(success)
	{
		response.success({'gold':gold});
	}).catch(function(error)
	{
		response.error(error);
	});

	});
	
});

AV.Cloud.define('IncreaseSilver', function(request, response)
{
	var silver = request.params.silver || 0;
	var mapID = request.params.mapID || 0;
	var userID = request.params.userID;
	if(silver > -1000 && silver != 0)
	{
		return response.error('参数错误!');
	}
	if(silver == 0)
	{
		silver = common.getMapSilver(mapID);
	}
	if(silver == 0)
	{
		return response.error('参数错误!');
	}
	var key = 'silver:'+userID;
	redisClient.incr(key, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('失败!');
		}
		redisClient.expire(key, 1);
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
			data.increment('silverCoin', silver);
			return data.save();
		}).then(function(success)
		{
			response.success('');
		}).catch(function(error)
		{
			response.error('获取银币失败!');
		});
	});
});

AV.Cloud.define('harvestPetGold', function(request, response)
{
	var userID = request.params.userID;
	var petID = request.params.petID;
	var key = "harvest:" + userID;
	var silver = 0;
	var date = new Date();
	redisClient.incr(key, function(err, id)
	{
		if(err || id > 1)
		{
			response.error('访问频繁!');
		}
		redisClient.expire(key, 2);

		new AV.Query('petInfo').equalTo('petID', petID).first().then(function(data)
		{
			var harvTime = new Date(data.get('goldHarvestAt').replace(/-/g,"/"));
			if(userID == data.get('userID'))//自己收获
			{
				if(harvTime > new Date())
				{
					return AV.Promise.error('还未到收获时间');
				}
				data.set('goldHarvestAt', common.FormatDate(date));
				silver = data.get('gold');
			}
			else
			{
				var gold = data.get('gold');
				var goldMax = data.get('goldMax');
				silver = parseInt(goldMax * 0.1);
				if(gold < goldMax * 0.4)
				{
					return AV.Promise.error('银币不足,无法偷取!');
				}
				else if(gold - silver < goldMax *0.4)
				{
					silver = parseInt(gold - goldMax*0.4);
				}
			}
			data.increment('gold', -1 * silver);
			return data.save();
		}).then(function(success)
		{
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(data)
		{
			data.increment('silverCoin', silver);
			return data.save();
		}).then(function(success)
		{
			response.success({'silver':silver});
		}).catch(function(error)
		{
			return response.error(error);
		});
	});

});

AV.Cloud.define('sendNotice', function(request, response)
{
	var userID = request.params.userID;
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
	});
});

AV.Cloud.define('IncreaseField', function(request, response)
{
	var userID = request.params.userID;
	var field = request.params.field;
	var dailyField = request.params.dailyField;
	var dateField = request.params.dateField;
	var otherID= request.params.otherID;
	var key = 'IncreaseField:'+userID;
	var type = request.params.type;
	redisClient.incr(key, function(err, id)
	{
		if(err || id > 1)
		{
			response.error('访问频繁!');
		}
		redisClient.expire(key, 1);
		return new AV.Query('chatUsers').equalTo('userID', otherID).first().then(function(data)
		{
			if(type && type < 0)
			{
				data.increment(field, -1);
			}
			else
			{
				data.increment(field, 1);
			}
			if(field == 'sexyNum' || field == 'adNum')
			{
				if(data.get('bProtect') > 0)
				{
					return AV.Promise.error('保护用户,无法举报!');
				}
			}
			if(dailyField)
			{
				var sameDay = false;
				var time = data.get(dateField);
				if(typeof(time) == "string")
				{	
					sameDay = common.checkDaySame(new Date(), new Date(time.replace(/-/g,"/")));
				}
				else if(time)
				{
					sameDay = common.checkDaySame(new Date(), time);
				}
				if(sameDay)
				{
					data.increment(dailyField, 1);
				}
				else
				{
					data.set(dailyField, 1);
				}
				data.set(dateField, common.FormatDate(new Date()));
			}
			return data.save();
		}).then(function(success)
		{
			response.success('success');
		}).catch(function(error)
		{
			response.error('失败!');
		});
	});
});

AV.Cloud.define('startBottleChat', function(request, response)
{
	var userID = request.params.userID;
	var cost = 0;
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
		return new AV.Query('chatUsers').equalTo('userID', userID).first().then(function(data)
		{
			var time = data.get('lastReceivetime');	
			var sameDay = false;
			if(data.get('receiveCount') < 0 )
			{
				return AV.Promise.error('参数错误!');
			}
			if(data.get('receiveCount') < 5)
			{
				cost = -20;
			}
			else if(data.get('receiveCount') < 10)
			{
				cost = -40;
			}
			else
			{
				cost = -20 * parseInt(data.get('receiveCount') / 10);
			}
			if(time)
			{	
				sameDay = common.checkDaySame(new Date(), new Date(time.replace(/-/g,"/")));
			}
			if(sameDay)
			{
				data.increment('receiveCount', 1);
			}
			else
			{
				data.set('receiveCount', 1);
				cost = -20;
			}
			if(data.get('goldNum') < -1*cost)
			{
				return AV.Promise.error('金币不足!');
			}
			data.set('lastReceivetime', common.FormatDate(new Date()));
			data.increment('goldNum', cost);
			data.fetchWhenSave(true);
			return data.save();
		}).then(function(success)
		{
			response.success({goldNum:data.get('goldNum'), goldMax:data.get('goldMax')});
		}).catch(function(error)
		{
			response.error(error);
		})
	});
});

AV.Cloud.define('setLottery', function(request, response){
	var userID = request.params.userID;
	return new AV.Query('chatUsers').equalTo('userID', userID).first().then(function(data)
	{
		data.set('lotteryDate', common.FormatDate(new Date()));
		data.save();
		response.success('');
	}).catch(function(error)
	{
		response.error('error');
	});
});

AV.Cloud.define('resetUserInfo', function(request, response)
{
	var userID = request.params.userID;
	var cost = 0;
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
		data.set('goldNum', 0);
		data.set('goldMax', 100);
		data.set('nickName', '');
		data.set('dailylike', 0);
		data.set('dailyUseGold', 0);
		data.set('dailygood', 0);
		data.set('Diamond', 0);
		data.set('beLikedNum', 0);
		data.set('greatNum', 0);
		data.set('badNum', 0);
		data.set('fensCount', 0);
		data.set('bSexSetable', 1);
		data.set('useGold', 0);
		return data.save();
	}).then(function(success)
	{
		response.success(success);
	}).catch(function(error)
	{
		response.error(error);
	});
});

AV.Cloud.define('useDiamond', function(request, response)
{
	var userID = request.params.userID;
	var tag = request.params.tag;
	var diamond  = 0;
	if(tag == 1)
	{
		diamond = -100;
	}
	else if(tag == 2)
	{
		diamond = -10;
	}
	else if(tag == 3)
	{
		diamond = -5;
	}
	else if(tag == 4)
	{
		diamond = -10;
	}
	else if(tag == 5)
	{
		diamond = -20;
	}
	else if(tag == 6)
	{
		diamond = -50;
	}
	else if(tag == 7)
	{
		diamond = -100;
	}
	else if(tag == 8)
	{
		diamond = -200;
	}
	else if(tag == 11)
	{
		diamond = -5;
	}
	else if(tag == 12)
	{
		diamond = -10;
	}
	if(diamond >= 0)
	{
		return response.error('参数错误!');
	}
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
		data.increment('Diamond', diamond);
		data.increment('useGold', -100 * diamond);
		if (data.get('dailyUseGoldAt') && common.checkDaySame(new Data(), data.get('dailyUseGoldAt')))
		{
			data.increment('dailyUseGold', -100 * diamond);
		}
		else
		{
			data.set('dailyUseGold', -100 * diamond);
		}
		return data.save();
	}).then(function(success)
	{
		response.success({Diamond:diamond});
	}).catch(function(error)
	{
		response.error('失败!');
	})
});

AV.Cloud.define('DaySign', function(request, response)
{
	var userID = request.params.userID;
	var goldNum = parseInt(300 + Math.random()*300);
	var goldVip = 0;
	var goldMax = 0;
	redisClient.incr("DaySign:"+userID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('DaySign:'+userID, 60);
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
			var last = data.get('lastQDtime');
			if(last && common.checkDaySame(last, new Date()))
			{
				return AV.Promise.error('已经签到过了!');
			}
			else
			{
				data.set('lastQDtime', common.FormatDate(new Date()));
				var vip = common.getVipType(data.get('BonusPoint'));
				if(vip > 0)
				{
					goldVip = vip * 100;
					if(Math.random() > 0.5)
					{
						goldMax = parseInt(30 + Math.random()*120);
					}
				}
				else if(Math.random() > 0.2)
				{
					goldMax = parseInt(30 + Math.random()*120);
				}
				data.increment('goldNum', gold+goldVip);
				if(goldMax > 0)
				{
					data.increment('goldMax', goldMax);
				}
				return data.save();
			}
		}).then(function(success)
		{
			return new AV.Query('qianDaoInfo').first();
		}).then(function(data)
		{
			var newValue = userID+'-'+'获得金币	'+(goldNum + goldVip);
			if(goldMax > 0)
			{
				newValue += ' 金币上限'+goldMax;
			}
			if(common.checkDaySame(data.updatedAt, new Date()))//同一天
			{
				newValue += data.get('qdIDs');
				data.increment('qdTotal', 1);
				data.set('qdIDs', newValue);
			}
			else
			{
				data.set('qdTotal', 1);
				data.set('qdIDs', newValue);
			}
			return data.save();
		}).then(function(success)
		{
			response.success({'goldNum':goldNum, 'goldVip':goldVip,'goldMax':goldMax});
		}).catch(function(error)
		{
			response.error(error);
		})
	})
});


module.exports = AV.Cloud;