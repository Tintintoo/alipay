var AV = require('leanengine');
//var reqCount = require('./reqCount');
var TUPU = require('tupu-node-sdk');

global.reqCenter = {};
function reqCount()
{
	return global.reqCenter;
}
var redisClient = require('./redis').redisClient;
var common = require('./common');

var gameRoom = AV.Object.extend('gameRoom');
var gameRoomLog = AV.Object.extend('gameRoomLog');
var gameErrorForbidden = AV.Object.extend('gameErrorForbidden');
var loverLikesLog = AV.Object.extend('loverLikesLog');
var petGamblingLog = AV.Object.extend('petGamblingLog');
var auctionItems = AV.Object.extend('auctionItems');
var package = AV.Object.extend('package');
var sealInfo = AV.Object.extend('sealInfo');
var visitorLog = AV.Object.extend('visitorLog');
var GiftSend = AV.Object.extend('GiftSend');
var GiftRecv = AV.Object.extend('GiftRecv');
var GiftSendLog = AV.Object.extend('GiftSendLog');
global.moneyLog = AV.Object.extend('moneyLog');
var acutionLog = AV.Object.extend('acutionLog');
var package = AV.Object.extend('package');
var landLog = AV.Object.extend('landLog');
global.failLog = AV.Object.extend('failLog');
global.giftInfo = {};
var seedrandom = require('seedrandom');

//是否在审核状态,审核状态不做处理
global.isReview = 1;

common.initGiftInfo();

//创建赌场房间
AV.Cloud.define('createGameRoom', function(request, response) 
{
	if(request.params.remoteAddress == '114.254.97.89')
	{
		return response.error('查询失败！');
	}
	//return response.error('error');
	//并发控制
	var req = reqCount();
	var key = "createGameRoom:" + request.params.userID;
	//并发控制
	redisClient.incr(key,function(err, id) 
	{
		if(err)
		{
			console.log(err);
			return response.error('访问太过频繁!');
		}
		redisClient.expire(key, 2);
		
		if(id > 1)
		{
			return response.error('访问太过频繁!');
		}
	var log = new gameRoomLog();
    log.set('userID', request.params.userID);
    log.set('gambling', request.params.gambling);
    log.set('placeID', request.params.place);
    log.set('gameID', request.params.game);
    log.set('roomTitle', request.params.title);
    var gambling = request.params.gambling;
	if(gambling <= 0)
	{
		return response.error('参数错误!');
	}
	var place = request.params.place;
	var query = new AV.Query('chatUsers');
    query.equalTo('userID', request.params.userID);
    var state = 0;
    var roomID = 0;

    var newDay = false;
    var roomCache = {};
	var now = new Date();

    return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
	{	
		if(!cache || cache != request.params.token)
		{
			if(global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
		}
		return redisClient.getAsync('gameRoom:'+request.params.userID);
	}).then(function(cache)
	{
		if(cache)
		{
			roomCache = JSON.parse(cache);
			var date = roomCache.date.split('-');
			if(date[0] != now.getFullYear() || date[1] != now.getMonth()+1 || date[2] != now.getDate())
			{
				newDay = true;
				roomCache.count = 10;
			}
		}
		else
		{
			newDay = true;
			roomCache.count = 10;
		}
		roomCache.date = now.getFullYear()+"-" +(now.getMonth()+1)+'-'+now.getDate();

    	return query.first();
	}).then(function (data)
    {
    	if(place < 5)
    	{
    		if(data.get('goldNum') < gambling)
    		{
    			//response.error('金币不足!');
    			return AV.Promise.error('金币不足,无法创建房间!');
    		}
    		data.increment('goldNum', 0-gambling);
    	}
    	else
    	{
    		//if(roomCache.count <= 0)
    		//{
    		//	return AV.Promise.error('可创建次数不足!');
    		//}
    		if(newDay == true)
			{
				roomCache.count += 10 * common.getVipType(data.get('BonusPoint'));
			}
    		roomCache.count -= 1;
    		if(data.get('Diamond') < gambling)
    		{
    			return AV.Promise.error('钻石不足,无法创建房间!');
    		}
    		data.increment('Diamond', 0-gambling);
    	}
    	return data.save()
    }).then(function(data)
    {
    	state = 1;
    	var obj = new gameRoom();
    	obj.set('userID', request.params.userID);
    	obj.set('gambling', request.params.gambling);
    	obj.set('placeID', request.params.place);
    	obj.set('gameID', request.params.game);
    	obj.set('roomTitle', request.params.title);
    	obj.fetchWhenSave(true);
   		return obj.save();
    }).then(function(data)
    {
    	redisClient.setAsync('gameRoom:'+request.params.userID, JSON.stringify(roomCache));
    	log.set('state', 2);
    	log.set('roomID', data.get('roomID'));
    	log.save();	
		return response.success('创建成功!');
    }).catch(function(error)
    {
    	log.set('state', state);
    	log.save();
		return response.error(error);
    });
});
    
});
//挑战异常检测
 var timer = setInterval(function() 
 {
 	if (process.env.LEANCLOUD_APP_ENV == 'stage') 
 	{
 		checkUserError();
 		return;
 		//clearInterval(timer);
 	}
 	checkPetGmabline();
 	checkPackageLog();
	
 }, 60000);

var giftSkip = 0;
var checkGiftInfo = setInterval(function()
{
	console.log('定时检测送礼异常!');
	clearInterval(checkGiftInfo);

	var query = new AV.Query('GiftSendLog');
	query.skip(giftSkip);
	giftSkip += 1000;
	query.limit(1000);
	query.containedIn('giftid',[26,89,890,21,88,480]);
	query.descending('createdAt');
	var ids = new Array();
	return query.find().then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			if(data.get('goldAfter') >= data.get('goldBefore') && data.get('diamondAfter') >= data.get('diamondBefore'))
			{
				var has = false;
				for(var j = 0; j < ids.length; j++)
				{
					if(ids[j] == data.get('fromID'))
					{
						has = true;
					}
				}
				if(has == false)
				{
					ids.push(data.get('fromID'));
				}
			}
		}
		console.log(ids);
	});
}, 10000);

var skip = 0;
function checkUserError()
{
	console.log('定时删除shareImg错误！');
	var query = new AV.Query('shareImg');
	query.limit(1000);
	query.skip(skip);
	skip += 1000;
	query.descending('createdAt');
	query.find().then(function(results)
	{
		var delArray = new Array;
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			var file = data.get('image');
			if(!file)
			{
				delArray.push(data);
			}
		}
		return AV.Object.destroyAll(delArray);
	}).then(function(success)
	{
		console.log('清除图片不在的数据!');
	}).catch(function(error)
	{
		console.log(error);
	});
 };
function checkPetGmabline()
{
	var query = new AV.Query('petGamblingLog');
 	query.descending('createdAt');
 	query.find().then(function(results)
	{
		var room = {};
		var userIDs = new Array();
		var infos = new Array();
		for (var i = results.length - 1; i >= 0; i--) 
		{
			var data = results[i];
			var key = data.get('roomID');
			if(key && key> 0 && room[key])//查到有2次一样的id,封号
			{
				var array = room[key];
				for (var  j= array.length - 1;  j>= 0; j--) {
					if(array[j] == data.get('startUserid'))//符合封号特征
					{
						userIDs.push(data.get('startUserid'));
						infos.push({'applyID':data.get('startUserid'),'winnerID':data.get('winnerID'),'loserID':data.get('loserID'),
						'place':data.get('placeID'), 'gambling':data.get('gambling'), 'roomID':key});
						console.log('封号:',JSON.stringify({'applyID':data.get('startUserid'),'winnerID':data.get('winnerID'),'loserID':data.get('loserID'),
						'place':data.get('placeID'), 'gambling':data.get('gambling'), 'roomID':key}));
					}
					else if(j == 0)//如果没有匹配成功
					{
						array.push(data.get('startUserid'));
					}
				}
				room[key] = array;
				//console.log(room[key]);
			}
			room[key] = [data.get('startUserid')];
			//console.log("roomKey:",room[key].length);
		}
		//clearInterval(timer);

		new AV.Query('chatUsers').containedIn('userID',userIDs).find().then(function(results){
			
			for (var i = results.length - 1; i >= 0; i--)
			 {
				var data = results[i];
				if(data.get('forbiddenState') != 0)//已经是封号状态,不做处理
			 	{
			 		continue;
			 	}
				var log = new gameErrorForbidden();
				data.set('forbiddenState', -1);
				log.set('userID', data.get('userID'));
				log.set('goldNum', data.get('goldNum'));
				log.set('Diamond', data.get('Diamond'));
				data.set('goldNum',-100000);
				data.set('Diamond',-100000);
				data.save();
				log.set('roomID', infos[i].roomID);
				log.set('applyID', infos[i].applyID);
				log.set('winnerID',infos[i].winnerID);
				log.set('loserID', infos[i].loserID);
				log.set('place', infos[i].place);
				log.set('gambling', infos[i].gambling);
				log.save();
			}
		});
	}).catch(console.log);	
}
function checkPackageLog()
{
	var query = new AV.Query('packageLog');
	query.lessThan('itemCount', -25);
	query.greaterThan('itemID', 39);
	query.lessThan('itemID', 49);
	query.descending('userID');
	query.descending('createdAt');
	var fields = ['userID', 'itemCount', 'itemID', 'itemCountMem'];
	//query.skip(1000);
	//query.limit(1000);
	query.find().then(function(results)
	{
		var users = new Array();
		var banned = new Array();
		var allUser = new Array();
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			var skip = false;
			allUser.push(data.get(fields[0]));
			for(var j = 0; j < users.length; j++)
			{
				if(data.get(fields[0]) == users[j])
				{
					skip = true;
					break;
				}
			}
			if(skip == true){
				continue;
			}
			if(i != results.length - 1)
			{
				var dataCheck = results[i+1];
				if(dataCheck.get(fields[0]) == data.get(fields[0]) &&
					dataCheck.get(fields[1]) == data.get(fields[1]) &&
					dataCheck.get(fields[2]) == data.get(fields[2]) &&
					dataCheck.get(fields[3]) == data.get(fields[3]) &&
					data.createdAt.getTime() - dataCheck.createdAt.getTime() < 3600000)
				{
					//console.log('封号[UserID:'+dataCheck.get(fields[0])+'itemCount'+data.get(fields[1])+"]");
					users.push(dataCheck.get('userID'));
					banned.push(dataCheck.get('userID'));
				}
			}
		}

		redisClient.getAsync('forbiddenUserID').then(function(cacheUser){
			if(cacheUser)
			{
			var array = cacheUser.split(",");
			for(var j = 0; j < users.length; j++)
			{
				var user = users[j];
				var has = false;
				for (var i = array.length - 1; i >= 0; i--) 
				{
					if(array[i] == user)
					{
						has = true;
					}
				}
				if(!has)
				{
					array.push(user);
				}
			}
			//console.log(array);
			redisClient.setAsync('forbiddenUserID', array.join(",")).catch(console.log);
			}
			else
			{
			redisClient.setAsync('forbiddenUserID', users.join(",")).catch(console.log);
			}
		});
		new AV.Query('auctionItems').containedIn('ownerID', users).find().then(function(results){
			for (var i = results.length - 1; i >= 0; i--) {
				results[i].set('buyer', 1);
			}
			AV.Object.saveAll(results);
		});
		new AV.Query('chatUsers').containedIn('userID',users).find().then(function(results){
			
			for (var i = results.length - 1; i >= 0; i--)
			 {
				var data = results[i];
				if(data.get('forbiddenState') != 0)//已经是封号状态,不做处理
			 	{
			 		continue;
			 	}
				var log = new gameErrorForbidden();
				data.set('forbiddenState', -1);
				log.set('userID', data.get('userID'));
				log.set('goldNum', data.get('goldNum'));
				log.set('Diamond', data.get('Diamond'));
				data.set('goldNum',-100000);
				data.set('Diamond',-100000);
				data.save();
				log.set('des', '道具日志出错,封号!');
				log.save();
			}
		});
	}).catch(console.log);
}
AV.Cloud.define('saveDailyLikeLovers', function(request, response)
{
	return response.error('出错!');

	var query = new AV.Query('chatUsers');
	query.greaterThan('lover', 0);
	query.descending('dailylike');
	query.limit = 1000;
	query.find().then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--) 
		{
			var data = results[i];
			var log = new loverLikesLog();
			log.set('userID', data.get('userID'));
			log.set('dailylike',data.get('dailylike'));
			log.set('rank', i+1);
			log.set('dailylikeAt', data.get('dailylikeAt'));
			log.set('lover', data.get('lover'));
			log.save();
		}
		response.success('成功!');
	}).catch(response.error);
});

//挑战房间
AV.Cloud.define('joinPetGameQueue', function(request, response)
{
	if(request.params.remoteAddress == '114.254.97.89')
	{
		return response.error('查询失败！');
	}
	//并发控制,根据room来控制,一个room只能发起一次请求
	var req = reqCount();
	var key = "JoingameRoom:" + request.params.roomID;
	redisClient.incr(key,function( err, id ) 
	{
		if(err)
		{
			return response.error('访问频繁!');
		}
		redisClient.expire(key, 2);
		if(id > 1)
		{
			return response.error('来迟一步,已经被人抢先了!');
		}
		//存储键值对到魂村服务器
		var win = 0;
		var userID = request.params.userID;
		var otherID = 0;
		var gambling = 0;
		var placeID = 0;
		var goldNum = 0 ;
		var diamond = 0;
		var log = new petGamblingLog();
		var room ;

		var newDay = 0;
		var roomCache = {count:0};
		var state = '';
		var random = seedrandom('added entropy.', { entropy: true });
		return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
		{	
			if(!cache || cache != request.params.token)
			{
				if(global.isReview == 0)
				{
					return AV.Promise.error('访问失败!');
				}
			}
			return redisClient.getAsync('gameRoom:'+userID);
		}).then(function(cache)
		{
			state += '1';
		//console.log('第'+state+"步");
		var now = new Date();
		if(cache)
		{
			roomCache = JSON.parse(cache);
			var date = roomCache.date.split('-');
			if(date[0] != now.getFullYear() || date[1] != now.getMonth()+1 || date[2] != now.getDate())
			{
				newDay = 1;
				roomCache.count = 20;
			}
		}
		else
		{
			newDay = 1;
			roomCache['count'] = 20;
		}
		roomCache['date'] = now.getFullYear()+"-" +(now.getMonth()+1)+'-'+now.getDate();
		//redisClient.setAsync('gameRoom:'+request.params.userID, JSON.stringify(data));

		return new AV.Query('gameRoom').equalTo('roomID', request.params.roomID).first();
		}).then(function(data)
		{
			state += '2';
			//console.log('第'+state+"步");
			if(!data)
			{
				return AV.Promise.error('来迟一步,已经被人抢先了!');
			}
			otherID = data.get('userID');
			gambling = data.get('gambling');
			placeID = data.get('placeID');
			if(data.get('placeID') == 5)
			{
				diamond = data.get('gambling');
				//if(roomCache.count <= 0)
				//{
				//	return AV.Promise.error('可挑战次数不足!');
				//}
				//roomCache.count -= 1;
			}
			else
			{
				goldNum = data.get('gambling');
			}
			room = data;

			var nValue = parseInt(random() * 10);
			if (request.params.newversion == 1 )
			{
				//新版本直接根据结果
				win = nValue%2;
				if(userID == 415509 && nValue%5 != 1)
				{
					win = 1;
				}
				if(otherID == 89)
				{
					win = 0;
				}
				return new AV.Query('chatUsers').containedIn('userID', [userID, otherID]).find();
			}
			else
			{
				state += '3';
				response.success(nValue);
				return AV.Promise.error('over');
			}
			
		}).then(function(results)
		{
			state += '4';
			//console.log('第'+state+"步");
			if(results.length != 2)
			{
				return AV.Promise.error('查询数据有误!');
			}
			for (var i = results.length - 1; i >= 0; i--) {
				var object = results[i];
				if(object.get('userID') == userID)
				{
					if(diamond > 0 && object.get('Diamond') < diamond)
					{
						return AV.Promise.error('钻石不足,加入失败!');
					}
					if(goldNum > 0 && object.get('goldNum') < goldNum)
					{
						return AV.Promise.error('金币不足,加入失败!');
					}
				}
				if(win == 1)
				{
					if(object.get('userID') == userID)
					{
						if(newDay == 1)
						{
							roomCache.count += 20 * common.getVipType(object.get('BonusPoint'));
							//console.log(roomCache.count);
						}
						log.set('winDiamondQ', object.get('Diamond'));
						log.set('winGoldNumQ', object.get('goldNum'));
						if(diamond >0)
						{
							object.increment('Diamond', diamond);
						}
						else
						{
							object.increment('goldNum', goldNum);
						}
					}
				}
				else
				{
					if(object.get('userID') == userID)
					{
						if(newDay == 1)
						{
							roomCache.count += 20 * common.getVipType(object.get('BonusPoint'));
							//console.log(roomCache.count);
						}
						log.set('loseDiamondQ', object.get('Diamond'));
						log.set('loseGoldNumQ', object.get('goldNum'));
						if(diamond > 0)
						{
							var diamondIncre = -1 * diamond;
							//if(limit.count > 0)
							//{
							//	diamondIncre = parseInt(-1 *diamond * 0.8);
							//	console.log('活动期间:' + userID + ',本该扣除钻石' + diamond +'实际扣除钻石:' + diamondIncre);
							//	limit.count -= 1;
							//	redisClient.setAsync("gameLimit:"+request.params.userID, JSON.stringify(limit));
							//}
							object.increment('Diamond', diamondIncre);

						}
						else
						{
							object.increment('goldNum', -1*goldNum);
						}
					}
					else
					{
						log.set('winDiamondQ', object.get('Diamond'));
						log.set('winGoldNumQ', object.get('goldNum'));
						if(diamond > 0)
						{
							object.increment('Diamond', 2*diamond);
						}
						else
						{
							object.increment('goldNum', 2*goldNum);
						}
					}

				}
				//data.fetchWhenSave(true);
			}
			return AV.Object.saveAll(results);
		}).then(function(results)
		{
			state += '5';
			//console.log('第'+state+"步");
			room.destroy();
			redisClient.set('gameRoom:' + request.params.userID, JSON.stringify(roomCache));
			log.set('startUserid', userID);
			if(win == 1)
			{
				log.set('winnerID', userID);
				log.set('loserID', otherID);
			}
			else
			{
				log.set('winnerID', otherID);
				log.set('loserID', userID);
			}
			log.set('roomID', request.params.roomID);
			log.set('gambling', gambling);
			log.set('placeID', placeID);
			log.set('gameID', 3);
			log.set('goldNum', goldNum);
			log.set('Diamond', diamond);
			log.save();
			response.success(win);
		}).catch(function(error) 
		{	
			state += '6';
			//console.log('第'+state+"步");
			if(error == 'over')
			{
				return 'over';
			}
			return response.error('来迟一步,已经被人抢先了');
		});
	});
});

//拍卖上架
AV.Cloud.define('upItem', function(request, response)
{
	if(request.params.remoteAddress == '114.254.97.89')
	{
		return response.error('查询失败！');
	}
	//return response.error('访问频繁!');
	//数值控制
	if(request.params.price <= 0 || request.params.itemCount <= 0)
	{
		return response.error('参数有误!');
	}
	var key = 'upItem:'+request.params.userID;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		redisClient.expire(key, 2);
		if(err)
		{
			return response.error('上架失败!');
		}
		if(id > 1)
		{
			return response.error('上架失败!');
		}

		//全局变量
		var newDay = false;
		var upCache = {};
		var fail = new global.failLog();
		fail.set('IPAddress', request.meta.remoteAddress);
		fail.set('action', '物品上架');
		//检查是否已经被封禁
		redisClient.getAsync('forbiddenUserID').then(function(cacheUser)
		{
			if(cacheUser)
			{
				var array = cacheUser.split(",");
				for (var i = array.length - 1; i >= 0; i--) {
					if(request.params.userID == array[i])
					{
						return response.error('账号已被封禁,无法使用上架服务!');
					}
				}
			}
		return redisClient.getAsync('token:' + request.params.userID);
		}).then(function(cache)
		{	
			if(!cache || cache != request.params.token)
			{
				if(global.isReview == 0)
				{
					return AV.Promise.error('访问失败!');
				}
			}
			return redisClient.getAsync('upItemLimit:'+request.params.userID)
		}).then(function(cache)
		{
			var now = new Date();
			if(cache)
			{
				upCache = JSON.parse(cache);
				var date = upCache.date.split('-');
				if(date[0] != now.getFullYear() || date[1] != now.getMonth()+1 || date[2] != now.getDate())
				{
					newDay = true;
					upCache.count = 5;
				}
			}
			else
			{
				newDay = true;
				upCache.count = 5;
			}
			upCache.date = now.getFullYear()+"-" +(now.getMonth()+1)+'-'+now.getDate();
			if(upCache.count <= 0 && request.params.userID != 6)
			{
				return response.error("上架次数不足,活动期间每天限制为10次!");
			}
			upCache.count -= 1;

			var query = new AV.Query('package');
			query.equalTo('userID', request.params.userID);
			query.equalTo('itemID', request.params.itemID);
			return query.first();

		}).then(function(data)
		{
			fail.set('step', 1);
			if(!data)
			{
				return AV.Promise.error("该物品已经没有了!");
			}
			var nItemCount = data.get('itemCount');
			if(nItemCount < request.params.itemCount)
			{
				return AV.Promise.error('道具数量不足!');
			}
			if(nItemCount == request.params.itemCount)
			{
				return data.destroy();
			}
			else
			{
				data.increment('itemCount', 0-request.params.itemCount);
				return data.save();
			}
		}).then(function(data)
		{
			fail.set('step', 2);

			var obj = new auctionItems;
			obj.set('ownerID', request.params.userID);
			obj.set('itemID', request.params.itemID);
			obj.set('itemCount', request.params.itemCount);
			obj.set('floorPrice', request.params.price);
			obj.set('itemName', request.params.name);
			if(request.params.otherName)
				obj.set('otherName', request.params.otherName);
			if(request.params.buyer)
				obj.set('buyer', request.params.buyer);
			obj.fetchWhenSave(true);
			return obj.save();
		}).then(function(obj)
		{
			redisClient.setAsync('upItemLimit:'+request.params.userID, JSON.stringify(upCache));

			fail.set('step', 3);
			var log = new acutionLog();
			log.set('ownerID', obj.get('ownerID'));
			log.set('acutionID', obj.get('auctionID'));
			log.set('buyFor', "上架");
			log.set('floorPrice', obj.get('floorPrice'));
			log.set('itemID', obj.get('itemID'));
			log.set('itemCount', obj.get('itemCount'));
			log.set('otherName', obj.get('otherName'));
			log.set('buyer', obj.get('buyer'));
			log.save();
			var auctionID = obj.get('auctionID');
			
			return response.success(auctionID);
		}).catch(function(error)
		{
			fail.set('errorInfo', error);
			fail.set('userID', request.params.userID);
			fail.set('itemID', request.params.itemID);
			fail.set('itemCount', request.params.itemCount);
			fail.save();
			return response.error('上架失败!');
		});
	});
});

//购买或下架
AV.Cloud.define('buyItem', function(request, response)
{
	if(request.params.remoteAddress == '114.254.97.89')
	{
		return response.error('查询失败！');
	}
	//return response.error('访问频繁!');
	var reqData = request.params;
	var key = 'buyItem:'+ request.params.auctionID;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		redisClient.expire(key, 2);
		if(id > 1)
		{
			return response.error('购买失败!');
		}
		var log = new moneyLog();
		var fail = new global.failLog();
		fail.set('action', '购买物品');
		fail.set('auctionID', reqData.auctionID);
		fail.set('userID', reqData.buyer);
		fail.set('IPAddress', request.meta.remoteAddress);
		log.set('des', "交易中心购买");

		return redisClient.getAsync('token:' + reqData.buyer).then(function(cache)
		{	
			if(!cache || cache != request.params.token)
			{
				if(global.isReview == 0)
				{
					return AV.Promise.error('访问失败!');
				}
			}
			var query = new AV.Query('auctionItems');
			query.equalTo('auctionID', reqData.auctionID);
			var auctionItem;
			var diamond = 0;
			var buyer = 0;

			return query.first();
		}).then(function(data)//查询数据
		{
			fail.set('step', 1);
			if (!data)
			{
				return AV.Promise.error('该物品已经被买走了');
			}
			reqData.owner = data.get('ownerID');
			reqData.price = data.get('floorPrice');
			reqData.itemID = data.get('itemID');
			reqData.itemCount = data.get('itemCount');
			log.set('acutionID', data.get('auctionID'));
			log.set('floorPrice', data.get('floorPrice'));
			log.set('userid', data.get('ownerID'));
			log.set('itemID', data.get('itemID'));
			log.set('itemCount', data.get('itemCount'));
			log.set('buyer', data.get('buyer'));
			buyer = data.get('buyer');
			if(data.get('buyer') && data.get('buyer') > 0 && data.get('buyer') != reqData.buyer && data.get('ownerID') != reqData.buyer)
			{
				return AV.Promise.error('指定购买人与实际购买人不一致!');
			}
			log.set('buyerName', data.get('otherName'));
			diamond = data.get('floorPrice');
			auctionItem = data;

			if(reqData.owner == reqData.buyer)
			{
				console.log('物品下架!'+reqData.owner);
				if(common.checkDaySame(data.createdAt, new Date()))//如果是当天上下架物品
				{
					redisClient.getAsync('upItemLimit:' + reqData.owner).then(function(cache)
					{
						var upCache = JSON.parse(cache);
						upCache.count += 1;
						redisClient.setAsync('upItemLimit:' + reqData.owner, JSON.stringify(upCache));
					});
				}
				
				return AV.Promise.as('The good result.');
			}

		//}).then(function(success)
		//{
			fail.set('step', 2);
			var query1 = new AV.Query('chatUsers');
	  		query1.equalTo('userID', reqData.buyer);

	  		var query2 = new AV.Query('chatUsers');
	  		query2.equalTo('userID', reqData.owner);
			var query = AV.Query.or(query1, query2);
			return query.find();
		}).then(function(results)
		{
			if(reqData.owner == reqData.buyer)
			{
				fail.set('action', "下架物品");
				return AV.Promise.as('The good result.');
			}
			fail.set('step', 3);
			
			for (var i = 0; i < results.length; i++)
			{
				var obj = results[i];
				if(obj.get('userID') == reqData.owner)//收钱方
				{

					log.set('diamondBefore', obj.get('Diamond'));

					if(buyer > 0)
					{
						if( obj.get('freeAuctionAt') && common.checkDaySame(new Date(), obj.get('freeAuctionAt')))
						{
							if(diamond >= 5 && diamond < 10)
							{
								diamond -= 1;
							}
							if(diamond >= 10 && diamond < 100)
							{
								diamond = parseInt(diamond * 0.9);
							}
							else if(diamond >= 100 && diamond < 500)
							{
								diamond = parseInt(diamond*0.85);
							}
							else if(diamond>= 500)
							{
								diamond = parseInt(diamond*0.8);
							}
						}
						else if(diamond >= 5)//5钻以下的东西不收手续费
						{
							obj.set('freeAuctionAt', new Date());
						}
					}
					else if(diamond >= 200)//超过200钻会收取10%的手续费
					{
						diamond = parseInt(diamond*0.9);
					}
					obj.increment('Diamond', diamond);
					log.set('diamondIncrease', diamond);
				}
				else
				{
					if(obj.get('Diamond') < reqData.price)
					{
						log.set('otherdiamondBefore', obj.get('Diamond'));
						//response.error('钻石数量不足!');
						return AV.Promise.error('钻石数量不足!');
					}
					obj.increment('Diamond', 0 - reqData.price);
				}
			}
			return AV.Object.saveAll(results);
		}).then(function(resutls)
		{
			fail.set('step', 4);
			log.set('otherid', reqData.buyer);
			if(reqData.owner == 6)
			{
				console.log('不删除'+reqData.owner);
				return AV.Promise.as('ok');
			}
			return  auctionItem.destroy();
		}).then(function(data)
		{
			fail.set('step', 5);
			query = new AV.Query('package');
			query.equalTo('userID', reqData.buyer);
			return query.find();
		}).then(function(results)
		{
			fail.set('step', 6);
			for (var i = results.length - 1; i >= 0; i--) {
				var obj = results[i];
				if (obj.get('itemID') == reqData.itemID) 
				{
					obj.increment('itemCount', reqData.itemCount);
					return obj.save();
				}
			}
			
			var obj = new package();
			obj.set('itemID', reqData.itemID);
			obj.set('itemCount', reqData.itemCount);
			obj.set('userID', reqData.buyer);
			return obj.save();
		}).then(function(success)
		{
			fail.set('step', 7);
			response.success({'price':diamond});
			if(reqData.owner != reqData.buyer)
			{
				log.save();
			}
			
		}).catch(function(error)
		{
			fail.set('errorInfo', error);
			fail.save();
			response.error(error);
		});	
	});
});

//拍卖上架
AV.Cloud.define('silverChange', function(request, response)
{
	//数值控制
	var gold = 0;
	var silver = 0;
	if(request.params.silver)
	{
		if(request.params.silver < 1000)
		{
			return response.error('银币不足!');
		}
		gold = request.params.silver/10;
		silver = 0-request.params.silver;
	}
	if(request.params.gold)
	{
		if(request.params.gold < 100)
		{
			return response.error('金币不足!');
		}
		gold = 0-request.params.gold;
		silver = request.params.gold * 10;
	}
	//并发控制
	var key = "silverChange," + request.params.userID;
	var req = reqCount();
	redisClient.incr(key, function(error, id)
	{
		redisClient.expire(key, 2);
		if(id > 1)
		{
			return response.error("兑换冷却中(每次兑换需要间隔6个小时)!");
		}
		var log = new global.moneyLog();
		var query = new AV.Query('chatUsers');
		query.equalTo('userID', request.params.userID);
		query.first().then(function(data)
		{
			if(!data)
			{
				return AV.Promise.error('There was an error.');
			}
			log.set('userid', data.get('userID'));
			log.set('goldBefore', data.get('goldNum'));
			log.set('silverBefore', data.get('silverCoin'));
			log.set('des','银币兑换');
			log.set('goldIncrease', gold);
			if(data.get('goldNum') < -1*gold  || data.get('silverCoin') < -1 * silver)
			{
				return AV.Promise.error('There was an error.');
			}
			data.increment('goldNum', gold);
			data.increment('silverCoin', silver);
			data.fetchWhenSave(true);
			return data.save();
		}).then(function(data)
		{
			log.set('goldAfter', data.get('goldNum'));
			log.set('silverAfter', data.get('silverCoin'));
			log.save();
			var retData = {goldNum:data.get('goldNum'), silverCoin:data.get("silverCoin")};
			//req[key] = parseInt(new Date().getTime()/3600000);
			return response.success(retData);

		}).catch(function(error)
		{
			log.save();
			return response.error('金币不足!');
		});
	});
});
AV.Cloud.define('saveLandLog', function(request, response)
{
  var object = new landLog();
  var clientIP = request.meta.remoteAddress;
  //console.log(clientIP);
  object.set('IPAddress', clientIP);
  object.set('userid', request.params.userID);
  object.set('version', request.params.version);
  object.set('hack', request.params.hack);
  object.save();
  response.success();
});

AV.Cloud.define('sealAccount', function(request, response) 
{
  var uuid = request.params.uuid;
  var userid = request.params.userID;
  var clientIP = request.meta.remoteAddress;
  return new AV.Query('chatUsers').equalTo('userID', userid).first().then(function(data)
  {
  	if(!data)
  	{
  		return response.error('未查询到用户信息!');
  	}
  	
  	var obj = new sealInfo();
  	obj.set('UUID',uuid);
  	obj.set('userID', userid);
  	obj.set('openid', data.get('openid'));
  	obj.set('phoneNum', data.get('MobilePhone'));
  	obj.set('IP',clientIP);
  	obj.save();
  	return response.success('success');
  }).catch(function(error)
  {
  	return response.error('未查询到用户信息!');
  });
  
});

AV.Cloud.define('checkAccount', function(request, response) 
{
	var uuid = request.params.uuid||'1234567';
	console.log('LogUUID:',uuid);
	if(uuid == 'D22DCC30-C639-4F86-9255-F0134EB58738'
	|| uuid == 'A4A22518-5869-4010-8242-C9E7794AB831'
	|| uuid == '6EB46823-22AB-4379-B2C4-C0558C18CA87')
	{
		console.log('禁止登陆'+uuid);
		return response.success('');
	}
	else
	{
		return response.error('暂未开放!');
	}
	
	var openid = request.params.openid||'1234567';
	var phone = request.params.phone||'1234567';
	var other = request.params.other||'123456';

	var query1 = new AV.Query('sealInfo');
  	query1.equalTo('UUID', uuid);

  	var query2 = new AV.Query('sealInfo');
  	query2.equalTo('openid', openid);

  	var query3 = new AV.Query('sealInfo');
  	query3.equalTo('phoneNum', phone);

  	var query4 = new AV.Query('sealInfo');
  	query4.equalTo('phoneNum', other);

	new AV.Query.or(query1, query2,query3,query4).find().then(function(results)
	{
		if(results.length == 0)
		{
			return response.error('未被封禁');
		}
		return response.success('该设备已经被封禁!');
	},function(error)
	{
		return response.success('服务器查询出错!');
	});
});
AV.Cloud.define('petRankFight', function(request, response)
{
	var req = reqCount();
	var key = "petRank:" + request.params.petID;
	var key2 = 'petRank:' + request.params.otherID;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		if(err)
		{
			return response.error('error');
		}
		redisClient.expire(key, 300);
		if(id > 1)
		{
			return response.error('宠物正在被挑战!');
		}
		else
		{
			redisClient.incr(key2, function(err, id)
			{
				redisClient.expire(key2, 300);
				if(id > 1)
				{
					return response.error('金币不足');
				}
				return response.success('success');
			});
		}
	});
	//改为存储到缓存,防止切换的时候出问题

});
AV.Cloud.define('clearPetRankFight',function(request, response)
{
	var req = reqCount();
	var key = "petRank:" + request.params.petID;
	var key2 = 'petRank:' + request.params.otherID;
	redisClient.delAsync(key);
	redisClient.delAsync(key2);
	response.success('请求成功!');
});
var gold = [0,20,50,150,250,400,700,900,1200,1500,2000];
var charm = [0,5,15,40,80,180,300,450,600,700,800];
var plantName = ['','萝卜','胡萝卜','橙子','南瓜','小麦','雏菊','葡萄','西瓜','玉米','康乃馨'];
AV.Cloud.define('harvestPlant',function(request, response)
{
	var req = reqCount();
	var key = 'Plant:'+ request.params.buildingNo;
	redisClient.incr(key, function(error, id)
	{
		redisClient.expire(key, 2);
		if(id > 1)
		{
			return response.error('收取失败!');
		}

		var goldCount = 0;
		var charmCount =0;
		var user = 0;
		var diamond = 0;
		var plantID  = 0;
		var count = 0;
		return new AV.Query('building').equalTo('buildingNo', request.params.buildingNo).first().then(function(data)
		{
			if(!data || data.get('plant') == 0)
			{
				return AV.Promise.error('查询失败!');
			}
			plantID = data.get('plant');
			var second = new Date().getTime()/1000 + 3600*8 - data.get('plantTime');
			var plantTime = (plantID * 8 +4)*3600;
			if(second < plantTime)//未到收获时间
			{	
				return AV.Promise.error('未到收获时间');
			}
			
			count = data.get('plantCount');
			if(count > (plantID * 2 + 10))
			{
				return AV.Promise.error('error');
			}
			goldCount = gold[plantID] * count;
			charmCount = charm[plantID] * count;
			user = data.get('userID');
			if (plantID >= 5)//如果此土地等级大于等于6
	        {
	            if (parseInt(Math.random() * 1000) % 10 ==0)
	            {
	                diamond = parseInt(Math.random() * 1000) % 20 + 1;
	            }
	         }
			data.set('plant',0);
			data.set('plantTime',0);
			data.set('plantCount', 0);
			return data.save();

		}).then(function(data)
		{
			return new AV.Query('chatUsers').equalTo('userID',user).first();
		}).then(function(data)
		{
			data.increment('goldNum', goldCount);
			data.increment('beLikedNum', charmCount);
			if(diamond > 0)
			{
				data.increment('Diamond', diamond);
			}
			//日魅力增加
			if(data.get('dailylikeAt') && common.checkDaySame(data.get('dailylikeAt'), new Date()))//同一天,直接增加日魅力
			{
				data.increment('dailylike', charmCount);
			}
			else
			{
				data.set('dailylike', charmCount);
				data.set('dailylikeAt', new Date());
			}
			data.fetchWhenSave(true);
			return data.save();
		}).then(function(data)
		{
			var retData = {'nCharmIncrease':charmCount,'goldIncrease':goldCount,'DiamondIncrease':diamond,
							'goldNum':data.get('goldNum'),'Diamond':data.get('Diamond'),'plant':plantID,'plantCount':count};
			
			response.success(retData);
		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

AV.Cloud.define('recoveryBuilding',function(request, response)
{
	var req = reqCount();
	var key = 'Recovery:'+ request.params.buildingNo;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		redisClient.expire(key, 2);
		if(id > 1)
		{
			return response.error('回收失败!');
		}
	var diamond =0;
	var gold =0;
	var userID = 0;


	new AV.Query('building').equalTo('buildingNo', request.params.buildingNo).first().then(function(data)
	{
		if(!data)
		{
			return AV.Promise.error('error');
		}
		if(data.get('isDiamond') == 1)
		{
			diamond = parseInt(data.get('value')/2);
		}
		else
		{
			gold = parseInt(data.get('value') /2);
		}
		var price = common.getBuildingItemPrice(data.get('buildingID'), data.get('buildingType'));
		if ((!price.gold && ! price.diamond) || (price.gold <= 0 && price.diamond <= 0))
		{
			return AV.Promise.error('参数错误!');
		}
		if (price.gold > 0 )
		{
			if(data.get('value') > price.gold || data.get('isDiamond') == 1)
			{
				return AV.Promise.error('建筑异常!');
			}
		}
		if (price.diamond > 0)
		{
			if(data.get('value') > price.diamond )
			{
				return AV.Promise.error('建筑异常!');
			}
		}
		userID = data.get('userID');
		return data.destroy(); 
	}).then(function(data)
	{
		return new AV.Query('chatUsers').equalTo('userID', userID).first();
	}).then(function(data)
	{
		if(diamond>0)
		{
			data.increment('Diamond', diamond);
		}
		else
		{
			data.increment('goldNum', gold);
		}
		return data.save();
	}).then(function(success){
		response.success({'diamond':diamond,'gold':gold})
	}).catch(function(error)
	{
		
		response.error(error);
	});
});
});

//偷取植物
AV.Cloud.define('stealPlant',function(request, response)
{
	var req = reqCount();
	key = 'steal:'+request.params.buildingNo;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		redisClient.expire(key, 2);
		if(id > 1)
		{
			return response.error('偷取失败!');
		}
		var query = new AV.Query('visitorLog');
		
		query.equalTo('visitorJob', 10);
		query.equalTo('buildingNo', request.params.buildingNo);
		query.equalTo('visitorID', request.params.userID);
		query.greaterThan('visitorTime', parseInt(new Date()/(86400000)) * 86400);

		var charmIncrease = 0;
		var hostUser = 0;
		var result = ''; 
		query.first().then(function(data)
		{
			if (data) 
			{
				return AV.Promise.error('error');
			}
			return new AV.Query('building').equalTo('buildingNo', request.params.buildingNo).first();
		}).then(function(data)
		{
			var plantCount = data.get('plantCount');
			if(data.get('plant') == 0 || plantCount <= data.get('plantMax') * 0.6)
			{
				return AV.Promise.error('error');
			}
			var stealCount = data.get('plantMax') * 0.2 *Math.random() + 1;//最少能偷取一个
			if(plantCount - stealCount < data.get('plantMax') * 0.6)
			{
				stealCount = data.get('plantMax') * 0.6 - plantCount;
			}
			if(stealCount < 1)
				return AV.Promise.error('error');
			data.increment('plantCount', parseInt(-1 * stealCount));
			charmIncrease = charm[data.get('plant')] * parseInt(stealCount);
			hostUser = data.get('userID');
			//data.fetchWhenSave(true);
			result = '偷取了'+parseInt(stealCount)+'个'+plantName[data.get('plant')];
			return data.save();
		}).then(function(data)
		{

			var log = new visitorLog();
			log.set('visitorJob', 10);
			log.set('visitorTime', parseInt(new Date().getTime()/1000));
			log.set('hostUser', hostUser);
			log.set('visitorID',request.params.userID);
			log.set('buildingNo',request.params.buildingNo);
			log.set('visitorName', request.params.userName);
			log.set('visitorResult',result);
			log.save();
			return new AV.Query('chatUsers').equalTo('userID', request.params.userID).first();
		}).then(function(data)
		{
			if(!data)
			{
				return AV.Promise.error('error');
			}
			data.increment('beLikedNum', charmIncrease);
			data.save();
			response.success('完成!');
		}).catch(function(error)
		{	
			
			response.error('error');
		});
	});
});

//结婚装饰续费
AV.Cloud.define('renewDecoration', function(request, response)
{
	var weddingType = 0;
	return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
	{	
		if(!cache || cache != request.params.token)
		{
			if(global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
		}
		return new AV.Query('chatUsers').equalTo('userID', request.params.userID).first()
	}).then(function(data)
	{
		if(!data)
		{
			return AV.Promise.error('error');
		}
		data.increment('goldNum', -50000);
		data.fetchWhenSave(true);
		return data.save();
	}).then(function(data)
	{
		if(data.get('goldNum') < 0)
		{
			return AV.Promise.error('error');
		}
		var query =  new AV.Query('building');
		query.equalTo('userID', data.get('userID'));
		query.equalTo('buildingType', 1);
		return query.first();
	}).then(function(data)
	{
		var now = parseInt(new Date().getTime()/1000);
		if(!data)
		{
			return AV.Promise.error('error');
		}
		if(data.get('decorateWeddingTime') > now)
		{
			//增加30天
			data.increment('decorateWeddingTime', 3600 * 24 *  30);
		}
		else
		{
			data.set('decorateWeddingTime', now + 3600 * 24 * 30);
		}
		var weddingType = data.get('isWedding');
		return data.save();	
	}).then(function(success)
	{
		response.success(parseInt(new Date().getTime / 1000 + 28800));
	}).catch(function(error){
		response.error('error');
	});
});
Date.prototype.Format = function (fmt) {
 //author: meizz 
 var o = {
 	"M+": this.getMonth() + 1, //月份 
 	"d+": this.getDate(), //日 
 	"h+": this.getHours(), //小时 
 	"m+": this.getMinutes(), //分 
 	"s+": this.getSeconds(), /////秒 
 	"q+": Math.floor((this.getMonth() + 3) / 3), //季度 
 	"S": this.getMilliseconds() //毫秒 
 	}; 
 	if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length)); 
 	for (var k in o) 
 		if (new RegExp("(" + k + ")").test(fmt)) 
 			fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length))); 
 	return fmt; 
 }

AV.Cloud.define('sendGift', function(request, response)
{
	if(request.params.remoteAddress == '114.254.97.89')
	{
		return response.error('查询失败!');
	}
	var userID = request.params.userID;
	var giftID = request.params.giftID;
	var toID = request.params.toID;
	var log = new GiftSendLog();
	var vipprice = [1.0,0.9,0.85,0.8,0.75,0.7,0.65,0.6,0.55,0.5,0.5,0.5,0.5];
	var step = 0;
	var gift = new AV.Object(JSON.parse(giftInfo[request.params.giftID]), {parse: true});
	var toUserName = '';
	var goldSend = 0;
	var diamondSend = 0;
	var loverIncrease = 1.0;
	var key = "sendGift:"+userID;
	//并发控制
	
	redisClient.incr(key,function( err, id ) 
	{
		redisClient.expire(key, 2);
		if(id > 1)
		{
			return response.error('送礼失败!');
		}
		return redisClient.getAsync('token:'+userID).then(function(cache)
		{	
			if(!cache || cache != request.params.token)
			{
				if(global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
			}
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(data)
		{
		if(!data)
		{
			return AV.Promise.error('错误!');
		}	
		if(data.get('lover') == toID)
		{
			loverIncrease = 1.15;
		}
		var needGold = gift.get('Gold') || 0;
		var needDiamond = gift.get('Diamond')||0;
		if(gift.get('Charm') > 0)
		{
			needGold *= vipprice[data.get('VIPType')];
			needDiamond *= vipprice[data.get('VIPType')];
		}
		if (needGold > 0 && data.get('goldNum') < needGold) {
			return AV.Promise.error('金币不足');
		}
		else if(needDiamond > 0 && data.get('Diamond') < needDiamond)
		{
			return AV.Promise.error('钻石不足!');
		}
		log.set('fromID', data.get('userID'));
		log.set('goldBefore', data.get('goldNum'));
		log.set('giftid', giftID);
		log.set('diamondBefore', data.get('Diamond'));

		
		//写入日消费
		if(gift.get('Charm') > 0)
		{
			data.increment('goldNum', -1* needGold );
			data.increment('Diamond', -1* needDiamond);
			if(data.get('dailyUseGoldAt') && common.checkDaySame(data.get('dailyUseGoldAt'), new Date()))
			{
				data.increment('dailyUseGold', needGold + needDiamond * 10);
			}
			else
			{
				data.set('dailyUseGold', needGold + needDiamond * 10);
				data.set('dailyUseGoldAt', new Date());
			}
			data.increment('useGold', needGold + needDiamond * 10);
		}
		else //赠送宝箱 没有优惠
		{
			data.increment('goldNum', -1* needGold);
			data.increment('Diamond', -1* needDiamond);
		}
		data.fetchWhenSave(true);
		return data.save();
		}).then(function(data)
		{
			log.set('goldAfter', data.get('goldNum'));
			log.set('diamondAfter', data.get('Diamond'));
			return new AV.Query('chatUsers').equalTo('userID', toID).first();
		}).then(function(data)
		{
			log.set('toID', data.get('userID', toID));
			log.set('otherGoldQ', data.get('goldNum'));
			log.set('otherDiamondQ', data.get('Diamond'));
			log.set('curMeili', data.get('beLikedNum'));

			data.increment('beLikedNum', gift.get('Charm'));
			//日魅力增加
			if(gift.get('Charm') > 0)
			{
				if(data.get('dailylikeAt') && common.checkDaySame(data.get('dailylikeAt'), new Date()))
				{
					data.increment('dailylike', parseInt(loverIncrease * gift.get('Charm')));
				}
				else
				{	
					data.set('dailylike', parseInt(loverIncrease * gift.get('Charm')));
					data.set('dailylikeAt', new Date());
				}
			}
			if(gift.get('goldSend') > 0)//金币宝箱
			{
				goldSend = gift.get('goldSend');
				if(gift.get('RandomMin') > 0 && gift.get('RandomMax')> 0)
				{
					goldSend = parseInt(Math.random() * (gift.get('RandomMax') - gift.get('RandomMin')) + gift.get('RandomMin'));
				}
				data.increment('goldNum', goldSend);
			}
			if(gift.get('DiamondSend') > 0)//钻石宝箱
			{
				diamondSend = gift.get('DiamondSend');
				if(gift.get('RandomMin') > 0 && gift.get('RandomMax')> 0)
				{
					diamondSend = parseInt(Math.random() * (gift.get('RandomMax') - gift.get('RandomMin')) + gift.get('RandomMin'));
				}
				data.increment('Diamond', diamondSend);
			}
			data.fetchWhenSave(true);
			return data.save();
		}).then(function(data)
		{
			toUserName = data.get('nickName');
			log.set('Meili', data.get('beLikedNum'));
			log.set('otherGoldH', data.get('goldNum'));
			log.set('otherDiamondH', data.get('Diamond'));
			return log.save();
		}).then(function(success)
		{
			var recv = new AV.Query('GiftRecv');
			recv.equalTo('userid', toID);
			recv.equalTo('giftid', giftID);
			console.log('GiftRecv'+toID+"gift:"+giftID);
			return recv.first();
		}).then(function(data)
		{
			if(data)
			{
				data.increment('count', 1);
				return data.save();
			}
			else
			{
				var giftrec = new GiftRecv();
				giftrec.set('userid', toID);
				giftrec.set('giftid', giftID);
				giftrec.set('giftName', gift.get('giftName'));
				giftrec.set('count', 1);
				return giftrec.save();
			}
		}).then(function(success)
		{
			var query = new AV.Query('GiftSend');
			query.equalTo('userid', userID);
			query.equalTo('giftid', giftID);
			console.log('giftSend'+userID+"gift:"+giftID);
			return query.first();
		}).then(function(data)
		{
			if(data)
			{
				data.increment('count', 1);
				return data.save();
			}
			else
			{
				var send = new GiftSend();
				send.set('userid', userID);
				send.set('giftid', giftID);
				send.set('giftName', gift.get('giftName'));
				send.set('count', 1);
				return send.save();
			}
		}).then(function(success)
		{
			response.success({'userName':toUserName,'goldSend':goldSend,'diamondSend':diamondSend});
		}).catch(function(error)
		{
			log.save();
			response.error(error);
		});
	});
});


AV.Cloud.define('endMarriage', function(request, response)
{
	var userID = request.params.userID;
	var other = 0;

	return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
	{	
		if(!cache || cache != request.params.token)
		{
			if(global.isReview == 0)
			{
				return AV.Promise.error('访问失败!');
			}
		}
		var query1 = new AV.Query('chatUsers');
  		query1.equalTo('userID', userID);

  		var query2 = new AV.Query('chatUsers');
  		query2.equalTo('lover', userID);
  		return AV.Query.or(query1, query2).find()
  	}).then(function(results)
	{
		if(results.length != 2)
		{
			return AV.Promise.error('离婚失败,请联系客服处理!');
		}
		for (var i = results.length - 1; i >= 0; i--)
		 {
		 	var data = results[i];
		 	if (data.get('lover') <= 0)
		 	{
		 		return AV.Promise.error('离婚失败,请联系客服处理!');
		 	}
		 	if(data.get('userID') != userID)
		 	{
		 		other = data.get('userID');
		 	}
		 	else 
		 	{
		 		if(data.get('goldNum') < 50000)
		 		{
		 			return AV.Promise.error('金币不足!');
		 		}
		 		data.increment('goldNum', -50000);
		 	}
			data.set('lover', 0);
		}
		return AV.Object.saveAll(results);
	
	}).then(function(success)
	{
		var query1 = new AV.Query('marryApply');
  		query1.equalTo('applyID', userID);

  		var query2 = new AV.Query('marryApply');
  		query2.equalTo('replyID', userID);
		return AV.Query.or(query1, query2).find();

	}).then(function(results)
	{
		return AV.Object.destroyAll(results);
	}).then(function(success)
	{
		var query1 = new AV.Query('marryUsers');
  		query1.equalTo('wife', userID);

  		var query2 = new AV.Query('marryUsers');
  		query2.equalTo('husband', userID);
  		return AV.Query.or(query1, query2).find();
	}).then(function(results)
	{
		return AV.Object.destroyAll(results);
	}).then(function(success)
	{
		var query1 = new AV.Query('building');
  		query1.equalTo('userID', userID);

  		var query2 = new AV.Query('building');
  		query2.equalTo('userID', other);
  		return AV.Query.or(query1, query2).find();
	}).then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--) 
		{
			var data = results[i];
			data.set('isWedding', 0);
			data.set('hallWeddingTime', 0);
			data.set('decorateWeddingTime', 0);
		}
		return AV.Object.saveAll(results);
	}).then(function(success)
	{
		return response.success('离婚离婚成功!');
	}).catch(function(error)
	{
		return response.error(error);
	});
});
var chestValue = {};
var timer3 = setInterval(function getChest()
{
	clearInterval(timer3);
	return new AV.Query('petSysChar').find().then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			if(data.get('sysID') == 100 || data.get('sysID') == 101 || data.get("sysID") == 102)
			{
				var value = data.get('strValue');
				var array = value.split(',');
				var newArray = new Array();
				for (var j = array.length - 1; j >= 0; j--) {
					var value = array[j];
					var keyvalue = value.split('-');
					newArray.push({'item': keyvalue[0], 'random':keyvalue[1]});
				}
				var key = data.get('sysID') - 83;
				chestValue[key] = newArray;
			}
		}
	});
}, 1000);


AV.Cloud.define('useChestBatch', function(request, response)
{
	var req = reqCount();
	var reqKey = "useChest:" + request.params.userID;
	var petID = request.params.petID;
	//并发控制
	redisClient.incr(reqKey,function( err, id ) 
	{
		redisClient.expire(reqKey, 2);
		if(id > 1)
		{
			return response.error('访问太过频繁!');
		}
		var random = seedrandom('added entropy.', { entropy: true });

		var itemID = request.params.itemID;
		var saveDatas = {};
		var plus = 0.0;
		var saveObjects = new Array();
		return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
		{	
			if(!cache || cache != request.params.token)
			{
				if(global.isReview == 0)
				{
					return AV.Promise.error('访问失败!');
				}
			}
			return new AV.Query('package').equalTo('userID', request.params.userID).find();
		}).then(function(results)
		{
			var data = undefined;
			for (var i = results.length - 1; i >= 0; i--) {
				if(results[i].get('itemID') == itemID)
				{
					data = results[i];
				}
			}
			if(!data)
			{
				return AV.Promise.error('error');
			}
			var count = data.get('itemCount');
			if(count > 20)
			{
				count = 20;
			}

			if(itemID > 11 && itemID < 16)//批量使用道具,累加所有增长
			{
				for (var i = count - 1; i >= 0; i--) 
				{
					plus += random();
				}
			}
			else//批量开宝箱
			{
				for(var i = 0; i < count; i++)
				{
					var number = random();
					var rand = Math.floor(number * 100);
					var array = chestValue[itemID];
					var size = 0;
					for (var j = array.length - 1; j >= 0; j--) 
					{
						if(rand >= size && rand < size+ parseInt(array[j].random))
						{
							if( saveDatas[array[j].item] )
							{
								saveDatas[array[j].item] += 1;
							}
							else
							{
								saveDatas[array[j].item] = 1;
							}
							break;
						}
						else
						{
							size += parseInt(array[j].random);
						}
					}
				}
				for(var key in saveDatas)
				{
					var bhas = false;
					for (var i = results.length - 1; i >= 0; i--) {
						if(results[i].get('itemID') == parseInt(key))
						{
							bhas = true;
							results[i].increment('itemCount', saveDatas[key]);
							saveObjects.push(results[i]);
							//results[i].save();
							break;
						}
					}
					if(bhas == false)
					{
						var obj = new package();
						obj.set('userID', request.params.userID);
						obj.set('itemID', parseInt(key));
						obj.set('itemCount', saveDatas[key]);
						saveObjects.push(obj);
					//obj.save();
					}
				}
			}
			saveDatas[itemID] = -1*count;
			if(data.get('itemCount') == count)
			{
				data.destroy();
			}
			else
			{
				data.increment('itemCount', -1* count);
			}
			saveObjects.push(data);
			if(itemID > 11 && itemID < 16)
			{
				return new AV.Query('petInfo').equalTo('petID', petID).first();
			}
			else
			{
				return AV.Object.saveAll(saveObjects);
			}
		}).then(function(data)
		{
			saveDatas.plus = parseInt(10 * plus);
			if (itemID == 12)
			{
				var bookCount = Math.floor(data.get('level')/10) *100 + saveDatas[itemID];
				if(data.get('attackBook') > bookCount)
				{
					return AV.Promise.error('使用失败,可使用次数不足!!');
				}
				data.increment('attackBook', -1*saveDatas[itemID]);
				data.increment('attackPlus', parseInt(10 * plus));

				saveObjects.push(data);
				return AV.Object.saveAll(saveObjects);
			}
			else if (itemID == 13)
			{
				var bookCount = Math.floor(data.get('level')/10) *100 + saveDatas[itemID];
				if(data.get('healthBook') > bookCount)
				{
					return AV.Promise.error('使用失败,可使用次数不足!!');
				}
				data.increment('healthBook', -1*saveDatas[itemID]);
				data.increment('healthPlus', parseInt(100 * plus));
				saveObjects.push(data);
				return AV.Object.saveAll(saveObjects);
			}
			else if (itemID == 14)
			{
				var bookCount = Math.floor(data.get('level')/10) *100 + saveDatas[itemID];
				if(data.get('defenseBook') > bookCount)
				{
					return AV.Promise.error('使用失败,可使用次数不足!!');
				}
				data.increment('defenseBook', -1*saveDatas[itemID]);
				data.increment('defensePlus', parseInt(5 * plus));
				saveObjects.push(data);
				return AV.Object.saveAll(saveObjects);
			}
			else if (itemID == 15)
			{
				var bookCount = Math.floor(data.get('level')/10) *100 + saveDatas[itemID];
				if(data.get('speedBook') > bookCount)
				{
					return AV.Promise.error('使用失败,可使用次数不足!!');
				}
				data.increment('speedBook', -1*saveDatas[itemID]);
				data.increment('speedPlus', parseInt(10 * plus));
				saveObjects.push(data);
				return AV.Object.saveAll(saveObjects);
			}
			else//开启宝箱结束
			{
				return AV.Promise.error('over');
			}
		}).then(function(success)
		{
			return response.success(saveDatas);
		}).catch(function(error)
		{
			if(error == 'over')
			{
				return response.success(saveDatas);
			}
			return response.error(error);
		});
	});
});

AV.Cloud.define('ComposeItem', function(request, response){
	var key = "upItem:" + request.params.userID;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		redisClient.expire(key, 2);
		if(id > 1)
		{
			return response.error('访问太过频繁!');
		}
		var item = request.params.itemID;
		var itemCount = parseInt(request.params.itemCount/5);
		if(item < 40 || item == 43 || item > 47 || request.params.itemCount < 5)
		{
			return response.error('无法合成!');
		}
		return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
		{	
			if(!cache || cache != request.params.token)
			{
				if(global.isReview == 0)
				{	
					return AV.Promise.error('访问失败!');
				}
			}
			var query = new AV.Query('package');
			query.equalTo('userID', request.params.userID);
			return query.containedIn('itemID', [item, item+1]).find()
		}).then(function(results)
		{
			var count = 0;
			for (var i = results.length - 1; i >= 0; i--) {
				var data = results[i];
				if(data.get('itemID') == item)
				{
					if(data.get('itemCount') < request.params.itemCount)
					{
						
						return AV.Promise.error('道具数量不足,无法合成!');
					}
					if(5*itemCount == data.get('itemCount'))
					{
						data.destroy();
						delObj = true;
					}
					else
					{
						data.increment('itemCount', -5*itemCount);
					}
					count += 2;
				}
				else 
				{
					count += 1;
					data.increment('itemCount', itemCount);
				}
			}
			if(count == 0 || count == 1)
			{
				return AV.Promise.error('数据异常!');
			}
			else if(count == 2)
			{
				var obj = new package();
				obj.set('itemID', item+1);
				obj.set('itemCount', itemCount);
				obj.set('userID', request.params.userID);
				results.push(obj);
			}
			return AV.Object.saveAll(results);
		}).then(function(success)
		{
			response.success('合成成功!');
		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

var petGift = {'29':{'goldNum':200, 'goldMax':200,'diamond':0, 'item':17,'itemCount':3},
'30':{'goldNum':500, 'goldMax':500,'diamond':10, 'item':17,'itemCount':6},
'31':{'goldNum':1000, 'goldMax':1000,'diamond':28, 'item':17,'itemCount':10},
'32':{'goldNum':2000, 'goldMax':2000,'diamond':68, 'item':18,'itemCount':3},
'33':{'goldNum':3000, 'goldMax':3000,'diamond':128, 'item':18,'itemCount':5},
'34':{'goldNum':5000, 'goldMax':5000,'diamond':188, 'item':18,'itemCount':10},
'35':{'goldNum':8000, 'goldMax':8000,'diamond':268, 'item':19,'itemCount':5},
'36':{'goldNum':12000, 'goldMax':10000,'diamond':388, 'item':19,'itemCount':10},
'37':{'goldNum':15000, 'goldMax':12000,'diamond':498, 'item':19,'itemCount':20},
'38':{'goldNum':30000, 'goldMax':15000,'diamond':498, 'item':19,'itemCount':50},
}
AV.Cloud.define('UseItem', function(req, res)
{	
	var key = "upItem:" + req.params.userID;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		redisClient.expire(key, 2);
		if(id > 1)
		{
			return res.error('访问太过频繁!');
		}
		var item = req.params.itemID;
		var newItem = -1;
		var saveObj = new Array();
		var meili = 0;
		return redisClient.getAsync('token:' + req.params.userID).then(function(cache)
		{	
			if(!cache || cache != req.params.token)
			{
				if(global.isReview == 0)
				{
					return AV.Promise.error('访问失败!');
				}
			}
			return new AV.Query('package').equalTo('itemID', item).equalTo('userID', req.params.userID).first();
		}).then(function(data)
		{
			if(!data || data.get('itemCount') <= 0)
			{
				return AV.Promise.error('道具不足,无法使用!');
			}

			var nAttackType = parseInt(Math.random()*10)%5;
			var items = {'46':[52, 52, 50, 50, 49], '47':[53, 53, 51, 51, 22], '48':[26, 26, 27, 27, 23]};
			if(item > 45 && item < 49)
			{
				if(data.get('itemCount') < 20)
				{
					return AV.Promise.error('道具不足,无法使用!');
				}
				newItem = items[item][nAttackType];
				if(data.get('itemCount') == 20)
				{
					data.destroy();
				}
				else
				{
					data.increment('itemCount', -20);
					saveObj.push(data);
				}
				return new AV.Query('package').equalTo('userID', req.params.userID).equalTo('itemID',newItem).first();
			}
			else if(item == 25 || item == 28)
			{
				if(data.get('itemCount') <= 0)
				{
					data.destroy();
					return AV.Promise.error('道具不足,无法使用!');
				}
				else if(data.get('itemCount') == 1)
				{
					data.destroy();
				}
				else 
				{
					saveObj.push(data);
					data.increment('itemCount', -1);
				}
				return new AV.Query('chatUsers').equalTo('userID', req.params.userID).first();
			}
			else
			{
				//data.increment('itemCount', -1);
				data.destroy();
				saveObj.push(data);
				return new AV.Query('chatUsers').equalTo('userID', req.params.userID).first();
			}
		}).then(function(data)
		{
			//开启宝箱
			if(newItem < 0)
			{
				if(!data)
				{
					return AV.Promise.error('查询失败!');
				}
				var level = (item - 29) * 10;
				if(data.get('petReword') > level)
				{
					
					return AV.Promise.error('你已经领取过礼包了!');
				}
				data.increment('goldNum', petGift[item]['goldNum']);
				data.increment('goldMax', petGift[item]['goldMax']);
				data.increment('Diamond', petGift[item]['diamond']);
				data.set('petReword', level+10);
				saveObj.push(data);
				return new AV.Query('package').equalTo('userID', req.params.userID).containedIn('itemID', 
					[item+1, petGift[item.toString()]['item']]).find();
			}
			else if(item == 25 || item == 28)
			{
				meili = Math.random() * 1000;
				if(item == 28)
				{
					meili *= 10;
				}
				data.increment('beLikedNum', meili);
				saveObj.push(data);
				return AV.Object.saveAll(saveObj);
			}
			else
			{
				if(data)
				{
					data.increment('itemCount', 1);
					saveObj.push(data);
				}
				else
				{
					var obj = new package();
					obj.set('itemID', newItem);
					obj.set('itemCount', 1);
					obj.set('userID', req.params.userID);
					saveObj.push(obj);
				}
				return AV.Object.saveAll(saveObj);
			}
		}).then(function(results)
		{
			if(newItem > 0)
			{
				res.success({'itemID':newItem,'charm':meili});
				return AV.Promise.error('success');
			}
			else
			{
				
				var count = 0;
				for (var i = results.length - 1; i >= 0; i--) {
					var data = results[i];
					if(data.get('itemID') == newItem)
					{
						count+= 1;
					}
					else 
					{
						count += 2;
						data.increment('itemCount', petGift[item.toString()]['itemCount']);
						saveObj.push(data);
					}
				}
				if((count == 2 || count == 0) && item < 38)
				{
					var obj = new package();
					obj.set('itemID', item+1);
					obj.set('itemCount', 1);
					obj.set('userID', req.params.userID);
					saveObj.push(obj);
				}
				if(count == 0 || count == 1)
				{
					var obj = new package();
					obj.set('itemCount', petGift[item.toString()]['itemCount']);
					obj.set('itemID', petGift[item.toString()]['item']);
					obj.set('userID', req.params.userID);
					saveObj.push(obj);
				}
				return AV.Object.saveAll(saveObj);
			}
		}).then(function(success)
		{
			if(newItem > 0)
			{
				res.success({'itemID':newItem});
			}else
			{
				res.success({'itemID':petGift[item.toString()]['item'], 'itemCount':petGift[item.toString()]['itemCount']});
			}
		}).catch(function(error)
		{
			if(error == 'success')
			{
				return;
			}
			res.error(error);
		})
	});
});

AV.Cloud.define('clientHeart', function(req, response)
{
	var userID = req.params.userID;
	var version = req.params.version;
	redisClient.getAsync(clientKey(userID)).then(function(cache)
	{
		if(cache)
		{
			var data = JSON.parse(cache);
			//console.log(data);
			data['online']++;
			redisClient.setAsync(clientKey(userID), JSON.stringify(data));
			//在线超过10分钟 弹出appstore评价页面
			if(data['online'] >= 10)
			{
				if(data['evaluate'] > 0 && data['version'] == version)//评价已经有值,并且跟当前版本号相同
				{
					var evaluate = data['evaluate'];
					//console.log(evaluate);
					//已经评价或者拒绝评价
					if(evaluate == 1 || evaluate == 2)
					{
						return response.error('已经评价过了');
					}
					else if(evaluate == 3)
					{
						var array = data['date'].split('-');
						var date = new Date();
						if(array && array.length == 3 &&
							array[0] == date.getFullYear()&& array[1] == date.getMonth()+1 && array[2] == date.getDate())
						{
							return response.error('还没到评价时间!');
						}
						else
						{
							//console.log('时间有问题');
							return response.success('appstore');
						}
					}
					else
					{
						//console.log('评价有问题');
						return response.success('appstore');
					}

				}
				else
				{
					//console.log(data);
					//console.log(cache);
					return response.success('appstore');
				}
			}
			else{
				return response.error('成功!');
			}
		}
		else
		{	
			var data = {'userID':userID,'online':1,'version':version};
			redisClient.setAsync(clientKey(userID), JSON.stringify(data));
			response.error('成功!');
		}
	}).catch(function(error)
	{
		response.error(error);
	});
});
function clientKey(userID)
{
	return 'client:'+userID;
}

AV.Cloud.define('userEvaluate', function(request, response)
{
	var userID = request.params.userID;
	var version = request.params.version;
	var evaluate = request.params.evaluate;
	redisClient.getAsync(clientKey(userID)).then(function(cacheUser)
	{
		if(cacheUser)
		{
			var data = JSON.parse(cacheUser);
			data['evaluate'] = evaluate;
			var date = new Date();
			data['date'] = date.getFullYear() + "-" + (date.getMonth()+1) + "-" +date.getDate();
			data['version'] = version;
			redisClient.setAsync(clientKey(userID), JSON.stringify(data));
			return response.success('成功!');
		}
		else
		{
			return response.error('未查询到数据!');
		}
	}).catch(response.error);
});

AV.Cloud.define('saveUUID', function(request, response)
{
	var userID = request.params.userID;
	var uuid = request.params.uuid;
	redisClient.setAsync("UUID:"+userID, uuid).catch(function(error)
	{
		console.log('保存UUID失败!');
	});
	response.success('');
});

AV.Cloud.define('getDeviceRight', function(request, response)
{
	var userID = request.params.userID;
	var uuid = request.params.uuid;
	redisClient.getAsync("UUID:"+userID).then(function(cache)
	{
		if(cache)
		{
			if(cache == uuid)
			{
				return response.success('success');
			}
			else
			{
				return response.error('出错!');
			}
		}
		else{
			return response.error('出错!');
		}
	}).catch(response.error);
});

AV.Cloud.define('increaseGroupActive', function(request, response)
{
	var groupID = request.params.groupID;
	var key = groupKey(groupID, new Date().getHours());
	redisClient.incr(key,function( err, id ) 
	{
		redisClient.expire(key, 3600 * 23);//23小时自动销毁
	});
	response.success('');
});
function groupKey(value, hour)
{
	return 'groupActive'+':'+value +','+ hour;
}
AV.Cloud.define('getGroupInfo', function(request, response)
{
	redisClient.keys(groupKey('*','*'), function (err, keys){
		if(!err)
      	{
        	var array = eval(keys);
        	var needSort = new Array();
        	var hour = new Date().getHours();
        	for (var i = array.length - 1; i >= 0; i--) {
        		var key = array[i];
        		
        		(function(mykey)
        		{
            		redisClient.getAsync(mykey).then(function(value)
          			{
          				if(value)
          				{
          					var active = 0;
          					var groupID = mykey.split(':')[1].split(',')[0];
           					var groupHour = parseInt(mykey.split(',')[1]);
           					if(hour == groupHour)
           					{
           						active = parseInt(value);
           					}
           					else if(hour - groupHour == 1)
           					{
           						active = parseInt(value * 0.5);
           					}
           					else if(hour - groupHour <= 6 && hour - groupHour > 0)
           					{
           						active = parseInt(value * 0.1);
           					}
           				
           					var has = false;
           					for (var i = needSort.length - 1; i >= 0; i--) {
           						if (needSort[i].groupID == groupID)
           						{
           							if(active > 0)
           							{
           								needSort[i].active += active;
           							}
           							has = true;
           						}	
           					}
           					if(has == false)
           					{
           						needSort.push({'groupID':groupID, 'active':active});
           					}
          				}
          				if(mykey == array[0])
            			{
            				needSort.sort(function(a,b){return b.active - a.active});
            				response.success(needSort.slice(0, 100));
            				//console.log(needSort);
           				}
            		});
         	 	})(key);
        	}
        	if(array.length == 0)
        	{
        		response.success([]);
        	}
        }
        else
        {
        	response.success([]);
        }
	});
});

AV.Cloud.define('delGroupActive', function(request, response)
{
	var groupID = request.params.groupID;
	var key = groupKey(groupID, '*');
	redisClient.keys(key, function (err, keys){
		if(!err)
      	{
        	var array = eval(keys);
        	for (var i = array.length - 1; i >= 0; i--) 
        	{
        		redisClient.delAsync(array[i]).catch(console.error);
        	}
        }
    });
});

AV.Cloud.define('dealSomething', function(request, response)
{
	return new AV.Query('aclTest').find().then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--) {
			console.log(results[i].get('MobilePhone'));
		}
	});
});

AV.Cloud.define('endMarriageNoGold', function(request, response)
{
	var userID = request.params.userID;
	var other = 0;
	
	var query1 = new AV.Query('chatUsers');
  	query1.equalTo('userID', userID);

  	var query2 = new AV.Query('chatUsers');
  	query2.equalTo('lover', userID);
  	return AV.Query.or(query1, query2).find().then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--)
		 {
		 	var data = results[i];
		 	if(data.get('userID') != userID)
		 	{
		 		other = data.get('userID');
		 	}
			data.set('lover', 0);
		}
		return AV.Object.saveAll(results);
	
	}).then(function(success)
	{
		var query1 = new AV.Query('marryApply');
  		query1.equalTo('applyID', userID);

  		var query2 = new AV.Query('marryApply');
  		query2.equalTo('replyID', userID);
		return AV.Query.or(query1, query2).find();

	}).then(function(results)
	{
		return AV.Object.destroyAll(results);
	}).then(function(success)
	{
		var query1 = new AV.Query('marryUsers');
  		query1.equalTo('wife', userID);

  		var query2 = new AV.Query('marryUsers');
  		query2.equalTo('husband', userID);
  		return AV.Query.or(query1, query2).find();
	}).then(function(results)
	{
		return AV.Object.destroyAll(results);
	}).then(function(success)
	{
		return response.success('离婚离婚成功!');
	}).catch(function(error)
	{
		return response.error('离婚失败!');
	});
});

AV.Cloud.define('checkUserUUID', function(request, response)
{
	var uuid = request.params.uuid;
	var userID = request.params.userID;
	redisClient.getAsync("UUID:"+userID).then(function(cache){
		if(uuid == cache)
		{
			response.success('success');
		}
		else
		{
			response.error('error');
		}
	}).catch(function(error)
	{
		response.error('error');
	});
});


module.exports = AV.Cloud;