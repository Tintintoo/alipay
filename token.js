var AV = require('leanengine');
var redisClient = require('./redis').redisClient;
var common = require('./common');
var http = require('https');
var urlutil=require('url');
var querystring = require('querystring');


var chatUsers = AV.Object.extend('chatUsers');
var userLog = AV.Object.extend('userLog');
var building = AV.Object.extend('building');
var marryUsers = AV.Object.extend('marryUsers');
var weddingCashLog = AV.Object.extend('weddingCashLog');
var weddingLog = AV.Object.extend('weddingLog');
var signLog = AV.Object.extend('Log_QianDao');
var growLog = AV.Object.extend('growLog');

AV.Cloud.define('LogInUserByPhone', function(request, response)
{
	//console.log('logInUserByPhone');
	var phoneNumber = request.params.phoneNumber;
	var enCodePhone = request.params.encodePhone;
	var passwd = request.params.passwd;
	var md5pwd = request.params.md5pwd;
	var userID = -1;

	var query1 = new AV.Query('chatUsers');
	query1.equalTo('MobilePhone', phoneNumber);

	var query2 = new AV.Query('chatUsers');
	query2.equalTo('MobilePhone', enCodePhone);

	return AV.Query.or(query1, query2).find().then(function(results)
	{
		if(results.length == 0)
		{
			return AV.Promise.error('未查询到对应账号!');
		}
		var has = false;

		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			if(data.get('Passwd') == passwd || data.get('Passwd') == md5pwd)
			{
				has = true;
				userID = data.get('userID');
				//return AV.Promise.error('密码错误');
			}
		}
		if(has == false)
		{
			return AV.Promise.error('密码错误!');
		}
		
		return redisClient.getAsync('token:' + userID);
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
		redisClient.expire(token, 86400 * 7);//7天有效期
		redisClient.expire('token:' + userID, 86400 * 7);//7天有效期
		
	}).catch(function(error)
	{
		return response.error(error);
	});
});

AV.Cloud.define('LogInUserByWeChat', function(request, response)
{
	//console.log('loginByWx');
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
		redisClient.expire(token, 86400*7);
		redisClient.expire('token:' + userID, 86400 * 7);
	}).catch(function(error)
	{
		return response.error(error);
	})
});

AV.Cloud.define('LogInByToken', function(request, response)
{
	//console.log('loginByToken' + parseInt(new Date().getTime()/1000));
	var token = request.params.token;
	redisClient.getAsync(token).then(function(cache)
	{
		if(cache)//得到用户,返回
		{
			redisClient.expire(token, 86400*7);
			redisClient.expire('token'+cache, 86400*7);
			//console.log('完事' + parseInt(new Date().getTime()/1000));
			response.success(parseInt(cache));
		}
		else
		{
			//console.log('完事' + parseInt(new Date().getTime()/1000));
			response.error('本地登录已经过期,请重新输入账户密码!');
		}
	}).catch(function(error)
	{
		//console.log('完事' + parseInt(new Date().getTime()/1000));
		response.error('未知错误!');
	});
});

AV.Cloud.define('checkPhoneUse', function(request, response)
{
	//console.log('checkPhoneUse');
	var phoneNumber = request.params.phoneNumber;
	var enCodePhone = request.params.encodePhone;
	var type = request.params.type;
	var query1 = new AV.Query('chatUsers');
	query1.equalTo('MobilePhone', phoneNumber);

	var query2 = new AV.Query('chatUsers');
	query2.equalTo('MobilePhone', enCodePhone);

	return AV.Query.or(query1, query2).first().then(function(data)
	{
		if(data)
		{
			if(type != 2)
			{
				return AV.Promise.error('该号码已经被注册了');
			}
		}
		else if(type == 2)
		{
			return AV.Promise.error('该号码还未注册账号!');
		}
		return AV.Cloud.requestSmsCode({mobilePhoneNumber: phoneNumber,name: '有朋',op: '短信验证',ttl:10});
	}).then(function(success)
	{
		response.success('');
	}).catch(function(error)
	{
		response.error(error);
	});
});

AV.Cloud.define('checkPhoneVerify', function(request, response)
{
	//console.log('checkPhoneVerify');
	var phoneNumber = request.params.phoneNumber;
	var encodePhone = request.params.encodePhone;
	var passwd = request.params.passwd;
	var code = request.params.code;
	var type = request.params.type;
	var userID = -1;
	redisClient.incr('phone:'+phoneNumber, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问太过频繁!');
		}
		redisClient.expire('phone:'+phoneNumber, 2);

		if(type != 1 && type != 2)
		{
			return response.error('无法识别的操作!');
		}
		return AV.Cloud.verifySmsCode(code, phoneNumber).then(function(success)
		{
			var query1 = new AV.Query('chatUsers');
			query1.equalTo('MobilePhone', phoneNumber);

			var query2 = new AV.Query('chatUsers');
			query2.equalTo('MobilePhone', encodePhone);

			return AV.Query.or(query1, query2).first();
		}).then(function(data){
			if(!data)
			{
				if(type == 1)//注册账号
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
					obj.set('Passwd', passwd);
					obj.fetchWhenSave(true);
					return obj.save();
				}
				else 
				{
					return AV.Promise.error('数据库出错!');
				}
			}
			if(type == 1)
			{
				return AV.Promise.error('该手机已经被注册了!');
			}
			data.set('Passwd', passwd);
			data.save();
			//注册账号 或是修改密码之后 需要一个新的token
			userID = data.get('userID');
			return redisClient.getAsync('token:'+userID);
			
		}).then(function(cache)
		{
			var token = common.createToken();
			if(cache)
			{
				redisClient.delAsync(cache);
			}
			redisClient.setAsync('token:'+userID, token);
			redisClient.setAsync(token, userID);
			redisClient.expire(token, 86400*7);
			redisClient.expire('token' + userID, 86400*7);

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
	//console.log('updateUserInfo');
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
				data.set('location', new AV.GeoPoint(point.lat, point.long));
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
			data.save();
			if(data.get('GagDate'))
			{
				if (new Date().getTime() < common.stringToDate(data.get('GagDate')).getTime())
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
	//console.log('好评');
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
		if(!mutiple || mutiple <= 0)
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
	var rate = {};
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
			if(cache)
			{
				rate = JSON.parse(cache);
				var last = common.stringToDate(rate.date);
				if(!rate.date || !common.checkDaySame(date, last))
				{
					rate.count = 10;
					rate.date = common.FormatDate(date);
					rate.user = [];
				}
			}
			else
			{
				rate.count = 10;
				rate.date = common.FormatDate(date);
				rate.user = [];
			}
			if(rate.count <= 0)
			{
				return AV.Promise.error('可评价次数不足');
			}
			for (var i = rate.user.length - 1; i >= 0; i--) 
			{
				if (rate.user[i] == userID)
				{
					return AV.Promise.error('你今天已经评价过他（她）了！');
				}
			}
			rate.user.push(userID);
			rate.count -= 1;
			redisClient.setAsync('Rated:'+fromID, JSON.stringify(rate));
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
				var gold = {goldNum:-50};//common.getBadReview(data.get('badNum'));
				resData = gold;
				resData.mutiple = mutiple;
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
			return new AV.Query('chatUsers').equalTo('userID', fromID).first();
		}).then(function(data)
		{
			data.increment('goldNum', parseInt(resData.goldNum * mutiple *0.5));
			return data.save();
		}).then(function(success)
		{			
			response.success(resData);
		}).catch(function(error)
		{
			if(error == 'over')
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
	//console.log('startChat');
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

	return redisClient.incr('shareLike:'+shareID, function(err, id) 
	{
		if(err || id > 1)
		{
			return response.error('访问太过频繁!');
		}
		redisClient.expire('shareLike:'+shareID, 1);
		
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
			return response.success({'gold':0});
		}
		if(tag == 10)
		{
			redisClient.expire(key, 50);
		}
		else
		{
			redisClient.expire(key, 1);
		}

		var shareInfo;
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
				shareInfo = data;
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
			else if(tag == 14)
			{
				gold = -50;
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
				gold = vip[data.get('VIPType')];
			}
			if(gold < 0 && data.get('goldNum') < gold)
			{
				return AV.Promise.error('金币不足!');
			}
			data.increment('goldNum', gold);
			if(goldMax > 0)
			{
				data.increment('goldMax', goldMax);
			}
			if(gold < 0)
			{
				data.increment('useGold', -1*gold);
				if(data.get('dailyUseGoldAt') && common.checkDaySame(new Date(), data.get('dailyUseGoldAt')))
				{
					data.increment('dailyUseGold', -1*gold);
				}
				else{
					data.set('dailyUseGold', -1*gold);
				}
				data.set('dailyUseGoldAt', new Date());
			}
			return data.save();
		}).then(function(success)
		{
			response.success({'gold':gold});
		}).catch(function(error)
		{
			if(tag == 10)
			{
				return response.success({'gold':0});
			}
			if(shareInfo)
			{
				shareInfo.destroy();
			}
			response.success({'gold':0});
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
			if(silver < -1000)//使用银币
			{
				data.increment('useGold', parseInt(-0.1*silver));
				if(data.get('dailyUseGoldAt') && common.checkDaySame(new Date(), data.get('dailyUseGoldAt')))
				{
					data.increment('dailyUseGold', parseInt(-0.1*silver));
				}
				else{
					data.set('dailyUseGold', parseInt(-0.1*silver));
				}
				data.set('dailyUseGoldAt', new Date());
			}
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
	//console.log('harvestPetGold');
	if(request.params.remoteAddress == '114.254.97.89'
		|| request.params.remoteAddress == '183.167.204.161')
	{
		return response.error('error');
	}
	var userID = request.params.userID;
	var petID = request.params.petID;
	var key = "harvest:" + userID;
	var silver = 0;
	var date = new Date();
	redisClient.incr(key, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁!');
		}
		redisClient.expire(key, 10);

		new AV.Query('petInfo').equalTo('petID', petID).first().then(function(data)
		{
			var harvTime = new Date(data.get('goldHarvestAt').replace(/-/g,"/"));
			if(userID == data.get('userID'))//自己收获
			{
				if(harvTime > new Date())
				{
					return AV.Promise.error('还未到收获时间');
				}
				var newTime = new Date(date.getTime() + parseInt(data.get('goldMax') * 600000/(common.getGoldIncrease(data.get('petType'), data.get('level')))));
				if ( (newTime.getTime() - new Date().getTime()) / 1000 > 7 * 86400)
				{
					console.log('宠物银币收货时间时间:'+common.FormatDate(newTime) +'宠物银币恢复速度:'+common.getGoldIncrease(data.get('petType'), data.get('level')));
				}
				data.set('goldHarvestAt', common.FormatDate(newTime));
				silver = data.get('gold');
				if (silver < 0)
				{
					return AV.Promise.error('收获失败!');
				}
				if (silver > data.get('goldMax'))
				{
					silver = data.get('goldMax');
				}
				if (silver > 150000)
				{
					silver = 150000;
				}
				data.set('gold', 0);
			}
			else
			{
				var gold = data.get('gold');
				var goldMax = data.get('goldMax');
				silver = parseInt(goldMax * 0.1);
				if(gold < goldMax * 0.4 || gold <= 0)
				{
					return AV.Promise.error('银币不足,无法偷取!');
				}
				else if(gold - silver < goldMax *0.4)
				{
					silver = parseInt(gold - goldMax*0.4);
				}
				if (silver > 15000)
				{
					silver = 15000;
					data.set('gold', data.get('goldMax'));
				}

				data.increment('gold', -1 * silver);
			}
			if (silver > 150000 || silver < 0 || silver > data.get('goldMax'))
			{
				return AV.Promise.error('收获失败!');
			}
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
			redisClient.expire(key, 3600 * 12);
			response.success({'silver':silver});
		}).catch(function(error)
		{
			return response.error(error);
		});
	});

});

AV.Cloud.define('IncreaseField', function(request, response)
{
	//console.log('increasefield');
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
			return response.error('访问频繁!');
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
	//console.log('捡瓶子');
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
	///console.log('useDiamond');
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
		if(diamond < 0 && data.get('Diamond') < -1*diamond)
		{
			return AV.Promise.error('钻石不足,无法购买!');
		}
		data.increment('Diamond', diamond);
		data.increment('useGold', -100 * diamond);
		if (data.get('dailyUseGoldAt') && common.checkDaySame(new Date(), data.get('dailyUseGoldAt')))
		{
			data.increment('dailyUseGold', -100 * diamond);
		}
		else
		{
			data.set('dailyUseGold', -100 * diamond);
		}
		data.set('dailyUseGoldAt', new Date());
		return data.save();
	}).then(function(success)
	{
		response.success({Diamond:diamond});
	}).catch(function(error)
	{
		response.error(error);
	})
});

AV.Cloud.define('DaySign', function(request, response)
{
	//console.log('DaySign');
	var userID = request.params.userID;
	var uuid = request.params.uuid;
	var price = {};
	var now = new Date();
	var info = {signCount:-1};
	var lastDay = new Date(now.getTime() - 86400000);
	var log = new signLog();
	redisClient.incr("DaySign:" + uuid, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('DaySign:' + uuid, 1);//60);

		return redisClient.getAsync('signInfo:' + uuid).then(function(cache)
		{	
			if(cache)
			{
				info = JSON.parse(cache);
				if (common.checkDaySame(now, common.stringToDate(info.date)))
				{
					return AV.Promise.error('签到失败,该设备已经签到过了!');
				}
				if(common.checkDaySame(lastDay, common.stringToDate(info.date)))
				{
					info['signCount'] += 1;
				}
				else
				{
					info['signCount'] = 0;
				}
			}
			else
			{
				info['signCount'] = 0;
			}
			if (info['signCount'] > 29)
			{
				info['signCount'] = 0;
			}
			info.date = now.getFullYear()+"-"+ (now.getMonth() + 1) + "-" + now.getDate();
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(user)
		{
			if (!user)
			{
				return AV.Promise.error('查询失败!');
			}
			log.set('userID', user.get('userID'));
			log.set('goldBefore', user.get('goldNum'));
			log.set('goldMaxBefore', user.get('goldMax'));
			log.set('diamondBefore', user.get('Diamond'));
			if (user.get('lastQDtime'))
			{
				var qdDate = new Date(user.get('lastQDtime').replace(/-/g,"/"));
				if(qdDate && common.checkDaySame(qdDate, now))
				{
					return AV.Promise.error('已经签到过了!');
				}
			}
			user.set('lastQDtime', common.FormatDate(now));
			var vip = user.get('VIPType');
			price =  common.getSignReword(vip, info['signCount']);

			price.day = info['signCount'];

			if(price.diamond && price.diamond > 0)
			{
				user.increment('Diamond', price.diamond);
			}
			if(price.gold && price.gold > 0)
			{
				user.increment('goldNum', price.gold + price.goldVip);
			}
			if(price.goldMax && price.goldMax > 0)
			{
				user.increment('goldMax', price.goldMax);
			}
			if(price.goldMaxVip > 0)
			{
				user.increment('goldMax', price.goldMaxVip);
			}
			user.fetchWhenSave(true);
			return user.save();
		}).then(function(data)
		{
			log.set('goldNum', data.get('goldNum'));
			log.set('goldMax', data.get('goldMax'));
			log.set('diamond', data.get('Diamond'));
			log.set('Day', price.day);
			log.save();

			return new AV.Query('qianDaoInfo').first();
		}).then(function(data)
		{
			var newValue = userID+'-'+'获得金币'+(price.gold + price.goldVip);
			var goldMax = price.goldMaxVip;
			if(price.goldMax && price.goldMax > 0)
			{
				goldMax += price.goldMax;
			}
			if (goldMax > 0)
			{
				newValue += ' 金币上限'+ goldMax;
			}
			if(price.diamond && price.diamond > 0)
			{
				newValue += ' 钻石'+(price.diamond);	
			}
			newValue += ',';
			if(common.checkDaySame(data.updatedAt, new Date()))//同一天
			{
				newValue += data.get('qdIDs');
				data.increment('qdTotal', 1);
				data.set('qdIDs', newValue.split(',').slice(0, 60).join(','));
			}
			else
			{
				data.set('qdTotal', 1);
				data.set('qdIDs', newValue);
			}
			return data.save();
		}).then(function(success)
		{
			redisClient.setAsync('signInfo:'+uuid, JSON.stringify(info));

			//console.log('签到' + parseInt(new Date().getTime()/1000));
			response.success(price);
		}).catch(function(error)
		{
			//console.log('签到' + parseInt(new Date().getTime()/1000));
			response.error(error);
		})			
	})
});

AV.Cloud.define('sendNotice', function(request, response)
{
	//console.log('sendNotice');
	var userID = request.params.userID;
	var type = request.params.type;
	var actid = request.params.actid;
	var goldNum = 0;
	var diamond = 0;
	if(type == 7 || type == 8 || type == 9 || type == 2 || type == 3)
	{
		return response.success('success');
	}
	if(type == 5)//普通广播
	{
		goldNum = -200;
		if(actid == 1)
		{
			diamond -= 1;
		}
		else if(actid == 2 || actid == 5 || actid == 6)
		{
			diamond -= 2;
		}
		else if(actid == 7 || actid == 3 || actid == 4)
		{
			diamond -= 3;
		}
	}
	else if(type == 6)
	{
		diamond = -5;
		if(actid == 1)
		{
			diamond -= 2;
		}
		else if(actid == 2 || actid == 5 || actid == 6)
		{
			diamond -= 4;
		}
		else if(actid == 7 || actid == 3 )
		{
			diamond -= 6;
		}
		else if(actid == 4)
		{
			diamond -= 12;
		}
	}
	else if(type == 1)
	{
		goldNum = -500;
		if (request.params.free == 1)
		{
			goldNum = 0;
		}
		if(actid == 1)
		{
			diamond -= 1;
		}
		else if(actid == 2 || actid == 5 || actid == 6)
		{
			diamond -= 3;
		}
		else if(actid == 7 || actid == 3 )
		{
			diamond -= 5;
		}
		else if(actid == 4)
		{
			diamond -= 10;
		}
		if (diamond == 0 && goldNum == 0)
		{
			return response.success({'goldNum':goldNum, 'diamond':diamond});
		}
		
	}
	if(goldNum >= 0 && diamond >= 0)
	{
		return response.error('参数错误!');
	}
	
	var now = new Date();
	redisClient.incr("Notice:"+userID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('Notice:'+userID, 1);
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
			if(goldNum < 0 && data.get('goldNum') < -1 * goldNum)
			{
				return AV.Promise.error('金币不足!');
			}
			if(diamond < 0 && data.get('Diamond') < -1 * diamond)
			{
				return AV.Promise.error('钻石不足!');
			}
			data.increment('goldNum', goldNum);
			data.increment('Diamond', diamond);
			return data.save();
		}).then(function(success)
		{
			response.success({'goldNum':goldNum, 'diamond':diamond});
		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

AV.Cloud.define('buyBuildItem', function(request, response)
{
	//console.log('buyBuildItem');
	var userID = request.params.userID;
	var itemID = request.params.itemID;
	var itemType = request.params.itemType;
	var price = common.getBuildingItemPrice(itemID, itemType);
	if ((!price.gold && ! price.diamond) || (price.gold <= 0 && price.diamond <= 0))
	{
		return response.error('参数错误!');
	}

	redisClient.incr("buyBuildItem:"+userID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('buyBuildItem:'+userID, 1);
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
			if(price.gold > 0)
			{
				if(price.gold > data.get('goldNum'))
				{
					return AV.Promise.error('金币不足!');
				}
				else
				{
					data.increment('goldNum', -1*price.gold);
				}
			}
			if(price.diamond > 0)
			{
				if(price.diamond > data.get('Diamond'))
				{
					return AV.Promise.error('钻石不足!');
				}
				else
				{
					data.increment('Diamond', -1*price.diamond);
				}
			}
			return data.save();
		}).then(function(success)
		{
			response.success(price);
		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

AV.Cloud.define('cultureBuilding', function(request, response)
{
	//console.log('culture');
	var userID = request.params.userID;
	var saveObj = [];
	var goldNum = 0;
	var diamond = 0;
	var up = 0;
	var needTime = 0;
	var exp = 0;
	var step = '0';
	redisClient.incr("cultureBuilding:"+userID, function(err, id)
	{
		step += 1;
		if(err || id > 1)
		{
			return response.error({error:'访问频繁'});
		}
		redisClient.expire('cultureBuilding:'+userID, 1);

		return redisClient.getAsync('token:' + userID).then(function(cache)
		{	
			step += 2;
			if(!cache || cache != request.params.token)
			{
				//评价人的令牌与userid不一致
				if (global.isReview == 0)
				{
					return AV.Promise.error({error:'访问失败!'});
				}
			}
			return new AV.Query('building').equalTo('buildingNo', request.params.buildNo).first();
		}).then(function(data)
		{
			step += 3;
			if(!data)
			{
				return AV.Promise.error('查询用户建筑失败!');
			}
			if(data.get('userID') != userID)
			{
				return AV.Promise.error('数据异常!');
			}
			var now = parseInt(new Date().getTime() / 1000);
			step += -1;
			if(request.params.gold == 1)//金币培养
			{
				exp = 10;
				var culture = new Date(new Date().getTime() - 86400000);
				if(data.get('lastGoldAt') && data.get('lastGoldAt').length > 0)
				{
					culture = new Date(data.get('lastGoldAt').replace(/-/g,"/"));
				}
				if(now - data.get('lastCultureAt') > 3600 * 4)//超过4小时 免费一次
				{
					data.set('lastCultureAt', now);
				}
				else 
				{
					needTime = 3600 * 4 - (now - data.get('lastCultureAt'));
					if(common.checkDaySame(new Date(), culture))
					{
						if(data.get('goldCount') <= 0)
						{
							return AV.Promise.error('可培养次数不足!');
						}
						goldNum = -1200 + (data.get('goldCount') - 10) * 200;
						data.increment('goldCount', -1);
					}
					else
					{
						data.set('lastGoldAt', common.FormatDate(new Date()));
						goldNum = -1200;
						data.set('goldCount', 9);
					}
				}
				if(data.get('exp') + 10 >= common.getBuildingExp(data.get('buildingLevel')))
				{
					up = 1;
					var level = data.get('buildingLevel');
					var nTime  = 3600 * 4;
					for (var i = 1; i< level; i++)
					{
						nTime *= 2;
					}
					nTime += parseInt(new Date().getTime()/ 1000);
					data.increment('buildingLevel', 1);
					data.set('buildingEnd', nTime);
				}
				data.increment('exp', 10);
				saveObj.push(data);
			}
			else
			{
				var culture = new Date(new Date().getTime() - 86400000);
				if(data.get('lastDiamondAt') && data.get('lastDiamondAt').length > 0)
				{
					culture = new Date(data.get('lastDiamondAt').replace(/-/g,"/"));
				}
				exp = 40;
				if(common.checkDaySame(new Date(), culture))
				{
					if(data.get('DiamondCount') <= 0)
					{
						return AV.Promise.error('可培养次数不足!');
					}
					if(data.get('DiamondCount') == 2)
					{
						exp += 20;
					}
					else if(data.get('DiamondCount') == 1)
					{
						exp += 60;
					}
					diamond = -50 + (data.get('DiamondCount') - 3) * 10;
					data.increment('DiamondCount', -1);
				}
				else
				{
					data.set('lastDiamondAt', common.FormatDate(new Date()));
					diamond = -50;
					data.set('DiamondCount', 2);
				}
				if(data.get('exp') + exp >= common.getBuildingExp(data.get('buildingLevel')))
				{
					up = 1;
					var level = data.get('buildingLevel');
					var nTime  = 3600 * 4;
					for (var i = 1; i< level; i++)
					{
						nTime *= 2;
					}
					nTime += parseInt(new Date().getTime()/ 1000);
					data.increment('buildingLevel', 1);
					data.set('buildingEnd', nTime);
				}
				data.increment('exp', exp);
				saveObj.push(data);
			}
			step += -2;
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(data)
		{
			step += 4;
			if(!data)
			{
				return AV.Promise.error('查询用户信息失败!');
			}
			if(goldNum < 0 && data.get('goldNum') < -1*goldNum)
			{
				return AV.Promise.error('金币不足!');
			}
			if(diamond < 0 && data.get('Diamond') < -1*diamond)
			{
				return AV.Promise.error('钻石不足!');
			}
			if(goldNum == 0 && diamond == 0)
			{
				return AV.Object.saveAll(saveObj);
			}
			if(goldNum < 0)
			{
				data.increment('goldNum', goldNum);
			}
			if(diamond < 0)
			{
				data.increment('Diamond', diamond);
			}
			saveObj.push(data);
			return AV.Object.saveAll(saveObj);
		}).then(function(success)
		{
			step += 5;
			response.success({'goldNum':goldNum,'diamond':diamond,'upgrade':up,'exp':exp, 'step':step});
		}).catch(function(error)
		{
			response.error({'error':error, 'time':needTime, 'step':step});
		});
	});

});

AV.Cloud.define('quickBuild', function(request, response)
{
	//console.log('quickBuild');
	var userID = request.params.userID;
	var buildNo = request.params.buildNo;
	var now = parseInt(new Date()/ 1000);
	var diamond = 0;
	var saveObj = [];
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
		return new AV.Query('building').equalTo('buildingNo', buildNo).first();
	}).then(function(data)
	{
		if(data.get('userID') != userID)
		{
			return AV.Promise.error('数据异常!');
		}
		var needTime = data.get('buildingEnd');
		//每加速10分钟需要一个钻石
		diamond = -1 * parseInt((needTime - now) / 600);
		if(diamond >= 0)
		{
			return AV.Promise.error("建筑无法加速!");
		}
		data.set('buildingEnd', 0);
		saveObj.push(data);
		return new AV.Query('chatUsers').equalTo('userID', userID).first();
	}).then(function(data)
	{
		if(data.get('Diamond') < -1 * diamond)
		{
			return AV.Promise.error('钻石不足,无法加速!');
		}
		data.increment('Diamond', diamond);
		saveObj.push(data);
		return AV.Object.saveAll(saveObj);
	}).then(function(success)
	{
		response.success({'diamond':diamond});
	}).catch(function(error)
	{
		response.error(error);
	})
});

AV.Cloud.define('growPlant', function(request, response)
{
	//console.log('plant');
	var userID = request.params.userID;
	var itemID = request.params.itemID;
	var fieldTag = request.params.fieldNo - 1;

	var log = new growLog();

	var saveObj = [];
	var price = common.getBuildingItemPrice(itemID, 3);
	if(!price.gold || price.gold <= 0)
	{
		return response.error('参数错误!');
	}
	var now = new Date();

	redisClient.incr("growPlant:" + fieldTag, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('growPlant:' + fieldTag, 1);

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
			if(data.get('goldNum') < price.gold)
			{
				return AV.Promise.error('金币不足!');
			}
			data.increment('goldNum', -1*price.gold);
			return data.save();
		}).then(function(success)
		{
			var query = new AV.Query('building');
			query.equalTo('userID', userID);
			query.equalTo('floorID', fieldTag.toString());
			return query.first();
		}).then(function(data)
		{
			if(!data || data.get('buildingType') != 3 || data.get('isLock') == 1)
			{
				return AV.Promise.error('请选择一块正确的土地种植!');
			}
			data.set('plant', itemID);
			data.set('plantTime', parseInt(now.getTime()/1000));
			data.set('plantCount', price.count);
			data.set('plantMax', price.count);
			log.set('plant', itemID);
			log.set('plantTime', common.FormatDate(new Date()));
			log.set('fieldNo', data.get('floorID'));
			log.set('userID', data.get('userID'));

			redisClient.expire('Plant:'+ data.get('buildingNo'), (3600 * 8 + 4) * itemID - 600);
			data.save();
		}).then(function(success)
		{
			log.save();
			response.success(price);
		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

AV.Cloud.define('expandField', function(request, response)
{
	//console.log('expandField');
	var userID = request.params.userID;
	var buildNo = request.params.buildNo;
	var saveObj = [];
	var price = {};

	redisClient.incr("expandField:" + buildNo, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('expandField:' + buildNo, 1);

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
			return new AV.Query('building').equalTo('buildingNo', buildNo).first();
		}).then(function(data)
		{
			if(!data || data.get('buildingType') != 3 || data.get('isLock') == 0)
			{
				return AV.Promise.error('土地数据有误,请退出重新刷新!');
			}
			price = common.getExpandPrice(data.get('floorID'));
			if(!price.gold || price.gold <= 0)
			{
				return AV.Promise.error('土地编号有误!');
			}
			data.set('isLock', 0);
			saveObj.push(data);
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(data)
		{
			if(!data || data.get('goldNum') < price.gold)
			{
				return AV.Promise.error('金币不足,无法扩建!');
			}
			data.increment('goldNum', -1*price.gold);
			saveObj.push(data);
			return AV.Object.saveAll(saveObj);
		}).then(function(success)
		{
			response.success(price);
		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

AV.Cloud.define('agreeMarriage', function(request, response)
{
	//console.log('agreeMarriage');
	var userID = request.params.userID;
	var otherID = request.params.otherID;
	var saveObj = [];
	var price = {};
	var husBandIcon = -1;
	var wifeIcon = -1;
	var husBand = -1;
	var wife = -1;

	redisClient.incr("agreeMarriage:" + userID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('agreeMarriage:' + userID, 1);

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
			return AV.Query.or(new AV.Query('chatUsers').equalTo('userID', userID), 
				new AV.Query('chatUsers').equalTo('userID', otherID)).find();
		}).then(function(results)
		{
			if(results.length != 2)
			{
				return AV.Promise.error('用户有误!');
			}
			for (var i = results.length - 1; i >= 0; i--) 
			{
				var data = results[i];
				if(data.get('lover') && data.get('lover') > 0)
				{
					return AV.Promise.error('自己或对方已经结婚了,无法结婚!');
				}
				if(data.get('userID') == userID)
				{
					data.set('lover', otherID);
				}
				else
				{
					data.set('lover', userID);
				}
				if(data.get('sex') == 2)
				{
					if(wifeIcon == -1)
					{
						wife = data.get('userID');
						wifeIcon = data.get('photoIndex');
					}
					else{
						husBand = data.get('userID');
						husBandIcon = data.get('photoIndex');
					}
				}
				else
				{
					if(husBandIcon == -1)
					{
						husBand = data.get('userID');
						husBandIcon = data.get('photoIndex');
					}
					else
					{
						wife = data.get('userID');
						wifeIcon = data.get('photoIndex');
					}
				}
			}
			return AV.Object.saveAll(results);
		}).then(function(success)
		{
			var obj = new marryUsers();
			obj.set('wife',wife);
			obj.set('wifeIcon', wifeIcon);
			obj.set('husband', husBand);
			obj.set('husBandIcon', husBandIcon);
			obj.set('weddingTime', 0);
			return obj.save();
		}).then(function(success)
		{
			return response.success();
		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

AV.Cloud.define('beginWedding', function(request, response)
{
	//console.log('beginWedding');
	var userID = request.params.userID;
	var type = request.params.type;
	var lover = -1;
	var now = new Date();
	if(type != 1 && type != 0)
	{
		return response.error('参数错误!');
	}
	var gold = 100000;
	if(type == 1)
	{
		gold = 990000;
	}
	redisClient.incr("beginWedding:" + userID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('beginWedding:' + userID, 1);

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
			if(!data || data.get('goldNum') < gold)
			{
				return AV.Promise.error('金币不足!');
			}
			lover = data.get('lover');

			data.increment('goldNum', -1*gold);
			data.increment('useGold', gold);
			if (data.get('dailyUseGoldAt') && common.checkDaySame(new Date(), data.get('dailyUseGoldAt')))
			{
				data.increment('dailyUseGold', gold);
			}
			else
			{
				data.set('dailyUseGold', gold);
			}
			data.set('dailyUseGoldAt', new Date());
			return data.save();
		}).then(function(success)
		{
			var query1 = new AV.Query('building');
			query1.equalTo('userID', userID);
			query1.equalTo('buildingType', 1);

			var query2 = new AV.Query('building');
			query2.equalTo('userID', lover);
			query2.equalTo('buildingType', 1);
			return AV.Query.or(query1, query2).find();
		}).then(function(results)
		{
			if(results.length != 2)
			{
				return AV.Promise.error('查询失败!');
			}
			for (var i = results.length - 1; i >= 0; i--) {
				var data = results[i];
				//两边都需要修改的数据
				if(type == 0)
				{
					data.set('isWedding', 1);
					data.set('decorateWeddingTime', parseInt(now.getTime()/1000) + 15 *24 *3600);
					data.set('hallWeddingTime', parseInt(now.getTime()/1000) + 1800);
					if(data.get('userID') == userID)
					{
						data.set('redPacket', 100);
					}
				}
				else 
				{
					data.set('isWedding', 2);
					data.set('decorateWeddingTime', parseInt(now.getTime()/1000) + 60 *24 *3600);
					data.set('hallWeddingTime', parseInt(now.getTime()/1000) + 7200);
					if(data.get('userID') == userID)
					{
						data.set('redPacket', 300);
					}
				}
			}
			return AV.Object.saveAll(results);
		}).then(function(success)
		{
			return AV.Query.or(new AV.Query('marryUsers').equalTo('wife',userID), 
				new AV.Query('marryUsers').equalTo('husband',userID)).find();
		}).then(function(results)
		{
			for (var i = results.length - 1; i >= 0; i--) {
				var data = results[i];
				if ((data.get('wife') == userID && data.get('husband') == lover) || 
					(data.get('husband') ==userID && data.get('wife') == lover))
				{
					if(type == 1)
					{
						data.set('weddingTime', parseInt(now.getTime()/1000) + 7200);
					}
					else
					{
						data.set('weddingTime', parseInt(now.getTime()/1000) + 1800);
					}
					return data.save();
				}
			}
			return AV.Promise.error('没有查询到对应结婚信息,请联系客服处理!');
		}).then(function(success)
		{
			response.success({'gold':gold});
		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

AV.Cloud.define('sendRedPacket', function(request, response)
{
	//console.log('sendRedPacket');
	var userID = request.params.userID;
	var gold = request.params.gold;
	var otherID = request.params.otherID;
	if (gold < 100)
	{
		return response.error('送的金币太少了,最少不得低于100!');
	}
	redisClient.incr("sendRedPacket:" + userID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('sendRedPacket:' + userID, 1);

		var log = new weddingCashLog();
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
			var query1 = new AV.Query('chatUsers').equalTo('userID', userID);
			var query2 = new AV.Query('chatUsers').equalTo('userID', otherID);
			var query3 = new AV.Query('chatUsers').equalTo('lover', otherID);
			return AV.Query.or(query1, query2, query3).find();
		}).then(function(results)
		{
			if(results.length != 3)
			{
				return AV.Promise.error('查询结果有错误!');
			}
			for (var i = results.length - 1; i >= 0; i--) {
				var data = results[i];
				if (data.get('userID') == userID)
				{
					if(data.get('goldNum') < gold)
					{
						return AV.Promise.error('金币不足!');
					}
					data.increment('goldNum', -1*gold);
				}
			}
			for (var i = results.length - 1; i >= 0; i--) {
				var data = results[i];
				if(data.get('userID') != userID)
				{
					data.increment('goldNum', parseInt(gold / 2));
				}
			}
			return AV.Object.saveAll(results);
		}).then(function(success)
		{
			log.set('weddingID', otherID);
			log.set('sender', userID);
			log.set('cash', gold);
			log.save();
			response.success({'gold':gold});

		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

AV.Cloud.define('getWeddingRedPacket', function(request, response)
{
	//console.log('getWeddingRedPacket');
	var userID = request.params.userID;
	var otherID = request.params.otherID;
	var gold = 0;
	redisClient.incr("getRedPacket:" + userID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('getRedPacket:' + userID, 1);

		var log = new weddingCashLog();
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
			return new AV.Query('weddingLog').equalTo('userID',userID).equalTo('hostUser', otherID).first();
		}).then(function(data)
		{
			if(data)
			{	
				return AV.Promise.error('你已经领取过他们的红包了!');
			}
			return new AV.Query('building').equalTo('userID', otherID).equalTo('buildingType', 1).first();
		}).then(function(data)
		{
			if(!data || data.get('redPacket') <= 0 || data.get('isWedding')<=0 || data.get('isWedding') > 2)
			{
				return AV.Promise.error('红包已经领完了!');
			}
			if(data.get('isWedding') == 1)
			{
				gold = Math.random() * 200;
			}
			else if(data.get('isWedding') == 1)
			{
				gold = Math.random()*1000;
			}
			data.increment('redPacket', -1);
			return data.save();
		}).then(function(success)
		{
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(data)
		{
			if(gold <= 0)
			{
				return AV.Promise.as('success');
			}
			data.increment('goldNum', gold);
			return data.save();
		}).then(function(success)
		{
			var log = new weddingLog();
			log.set('hostUser', otherID);
			log.set('userID', userID);
			log.set('goldNum', gold);
			log.save();
			response.success({'gold':gold});
		}).catch(function(error)
		{
			response.error(error);
		});
	})
});

AV.Cloud.define('checkNet', function(request, response)
{
	return response.success('success');
});

AV.Cloud.define('JoinMembership', function(request, response)
{
	//console.log('joinMember');
	var userID = request.params.userID;
	var month = request.params.month;
	var price = {1:-20, 3:-54, 6:-102,12:-196};
	var diamond = price[month] || 0;
	var vipType = 0;
	if(diamond >= 0)
	{
		return response.error('参数错误!');
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
	}).then(function(data){
		if(data.get('Diamond') < -1*diamond)
		{
			return AV.Promise.error('钻石不足,无法开通或续费!');
		}
		data.increment('Diamond', diamond);
		var vipDate = common.stringToDate(data.get('VIPDay'));
		vipType = common.getVipType(data.get('BonusPoint'));
		if(vipType == 0)
		{
			vipType = 1;
		}
		//如果是续费,无需改动
		if(common.checkDayGreater(vipDate, new Date()))
		{

			data.set('VIPDay', common.FormatDate(common.addMonth(new Date(vipDate.getTime()+86400000), month)));
		}
		else
		{
			data.set('VIPDay', common.FormatDate(common.addMonth(new Date(), month)));
		}
		//写入消耗
		data.increment('useGold', -100 * diamond);
		if (data.get('dailyUseGoldAt') && common.checkDaySame(new Date(), data.get('dailyUseGoldAt')))
		{
			data.increment('dailyUseGold', -100 * diamond);
		}
		else
		{
			data.set('dailyUseGold', -100 * diamond);
		}
		data.set('dailyUseGoldAt', new Date());
		//
		data.increment('goldNum', 500 * month);
		data.increment('goldMax', 500 * month);
		data.set('VIPType', vipType);
		return data.save();
	}).then(function(data)
	{
		response.success({'diamond':diamond, 'goldNum':500 * month,'goldMax':500 * month, vip:vipType});
	}).catch(function(error)
	{
		response.error(error);
	});
});

AV.Cloud.define('getSerialSignReword', function(request, response)
{
	//console.log('getSerialSignReword');
	var userID = request.params.userID;
	var uuid = request.params.uuid;
	var dayReword = [{day:1,gold:100}, {day:2,gold:150}, {day:3,gold:200, goldMax:100,diamond:5}, {day:4,gold:240}, 
    {day:5,gold:300,goldMax:150}, {day:6,gold:350},{day:7,gold:400, goldMax:200, diamond:8},
    {day:8,gold:500}, {day:9,gold:600}, {day:10,gold:700,goldMax:240,diamond:10},
    {day:11,gold:800},{day:12,gold:900,goldMax:300},{day:13,gold:1000},{day:14,gold:1100},{day:15,gold:1200,diamond:20},{day:16,gold:1300},
    {day:17,gold:1500},{day:18,gold:1600,goldMax:400},{day:19,gold:1700},{day:20,gold:2000,goldMax:450, diamond:25},
    {day:21,gold:2100},{day:22,gold:2200},{day:23,gold:2400},{day:24,gold:2500},{day:25,gold:3000,goldMax:600,diamond:30},
    {day:26,gold:3100},{day:27,gold:3200},{day:28,gold:3300},{day:29,gold:3400},{day:30,gold:4000,goldMax:800,diamond:40}];

    var info = {};
    var now = new Date();
    var lastDay = new Date(now.getTime() - 86400000);	
	redisClient.getAsync('token:' + userID).then(function(cache)
	{	
		if(!cache || cache != request.params.token)
		{
			//评价人的令牌与userid不一致
			if (global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
		}
		return redisClient.getAsync('signInfo:'+ uuid);
	}).then(function(cache)
	{
		if(cache)
		{
			info = JSON.parse(cache);
			if (info.date && common.checkDaySame(now, common.stringToDate(info.date)))
			{
				return response.error('你已经签到过了,一台设备每天只能签到一次!');
			}
			if(info.signCount < 29 && common.checkDaySame(lastDay, common.stringToDate(info.date)))
			{
				info.signCount += 1;
			}
			else
			{
				info.signCount = 0;
			}
		}
		else
		{
			info.signCount = 0;
		}

		response.success({reword:dayReword,day:info.signCount});
	}).catch(function(error)
	{
		response.error(error);
	});
});

AV.Cloud.define('getUserGamblingInfo', function(request, response)
{
	//console.log('getUserGamblingInfo');
	return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
	{	
		if(!cache || cache != request.params.token)
		{
			if (global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
		}
		return redisClient.getAsync('gamblingLog:' + request.params.userID);
	}).then(function(cache)
	{
		if(!cache)
		{
			response.success({'userID':request.params.userID, 'win':0,'lose':0,'winGold':0,'loseGold':0,'winDiamond':0,'loseDiamond':0});
		}
		else
		{
			response.success(JSON.parse(cache));
		}
	}).catch(function(error)
	{
		response.error('查询失败!');
	})
});

AV.Cloud.define('saveChatListUser', function(request, response)
{
	//暂时关闭
	if (process.env.LEANCLOUD_APP_ENV != 'stage') 
	{
		return response.success([]);
	}
	var userID = request.params.userID;
	var otherID = request.params.otherID;
	var users = request.params.users;
	return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
	{	
		if(!cache || cache != request.params.token)
		{
			if (global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
		}
		return redisClient.getAsync('chatListUser:'+userID);
	}).then(function(cache)
	{
		var array = new Array();
		if(cache)
		{
			array = cache.split(',');
		}
		if (otherID)
		{
			for (var i = array.length - 1; i >= 0; i--) {
				if (array[i] == otherID)
				{
					return response.error('该账号已经存储过了!');
				}
			}
			//向数组头添加一个元素
			array.unshift(otherID);
		}
		else
		{
			for (var i = 0; i < users.length; i++) {
				var has = false;
				for (var j = 0; j < array.length; j++)
				{
					if (users[i] == array[j])
					{
						has = true;
					}
				}
				if (!has)
				{
					array.push(users[i]);
				}
			}
		}
		redisClient.setAsync('chatListUser:' + userID, array.join(','));
		response.success('success');
	}).catch(function(error)
	{
		//console.log('saveChatListUser');
		//console.log(error);
		return response.error('error');
	})
});

AV.Cloud.define('getChatListUser', function(request, response)
{
	//暂时关闭
	if (process.env.LEANCLOUD_APP_ENV != 'stage') 
	{
		return response.success([]);
	}

	var userID = request.params.userID;
	return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
	{	
		if(!cache || cache != request.params.token)
		{
			if (global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
		}
		return redisClient.getAsync('chatListUser:'+userID);
	}).then(function(cache)
	{
		var array = new Array();
		if(cache)
		{
			array = cache.split(',');
		}
		return response.success(array);
	}).catch(function(error)
	{
		//console.log('getChatListUser');
		//console.log(error);
		response.error('error');
	})
})

AV.Cloud.define('delChatListUser', function(request, response)
{
	//暂时关闭
	if (process.env.LEANCLOUD_APP_ENV != 'stage') 
	{
		return response.success([]);
	}

	var userID = request.params.userID;
	var otherID = request.params.otherID;
	return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
	{	
		if(!cache || cache != request.params.token)
		{
			if (global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
		}
		return redisClient.getAsync('chatListUser:'+userID);
	}).then(function(cache)
	{
		var array = new Array();
		if(cache)
		{
			var old = cache.split(',');
			for (var i = 0; i < old.length; i++) {
				if ( old[i] != otherID)
				{
					array.push(old[i]);
				}
			}
		}
		redisClient.setAsync('chatListUser:' + userID, array.join(','));
		response.success('success');
	}).catch(function(error)
	{
		return response.error('error');
	})
});

AV.Cloud.define('getWeChatOpenID', function(request, response)
{
	var code = request.params.code;
	var apiurl = 'https://api.weixin.qq.com/sns/oauth2/access_token?appid=wxf3633e02a28d60f0&secret=e3738a2c867cdf51801da9caa5b0b883&code='+code+'&grant_type=authorization_code';
	var options = 
	{
		url: apiurl,
		method: "GET",
	};
 	AV.Cloud.httpRequest({
  	method: 'GET',
 	 headers: {
  	  'Content-Type': 'application/json'
  	},
  	url: apiurl,
  	success: function(httpResponse) {
  		//console.log(httpResponse.text);
  		var data = JSON.parse(httpResponse.text);
  		if (data.errcode)
  		{
  			response.error(data.errmsg);
  		}
  		else
  		{
  			response.success(data);
  		}
  	}
  	});
})


module.exports = AV.Cloud;