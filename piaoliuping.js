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
var WXPay = require('./lib/wxpay');
var util = require('./lib/util');
var md5 = require('MD5');
var crypto = require('crypto');
var fs = require("fs");
var moment = require('moment');

var gameRoom = AV.Object.extend('gameRoom');
var gameRoomLog = AV.Object.extend('gameRoomLog');
var gameErrorForbidden = AV.Object.extend('gameErrorForbidden');
var loverLikesLog = AV.Object.extend('loverLikesLog');
var gamblingLog = AV.Object.extend('gamblingLog');
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
var gamblingInfo = AV.Object.extend('gamblingInfo');
var clientHeartLog = AV.Object.extend('clientHeart');
var WeChatOrder = AV.Object.extend('wechatOrder');
var alipayOrder = AV.Object.extend('alipayOrder');
var plantLog = AV.Object.extend('plantLog');
var silverLog = AV.Object.extend('SilverLog');
var wolfKill = AV.Object.extend("wolfKill");


//是否在审核状态,审核状态不做处理
global.isReview = 1;

common.initGiftInfo();

//创建赌场房间
AV.Cloud.define('createGameRoom', function(request, response) 
{
	//console.log('createGameRoom');
	if(request.params.remoteAddress == '114.254.97.89')
	{
		return response.error('查询失败！');
	}
	//并发控制
	var key = "createGameRoom:" + request.params.userID;
	//并发控制
	redisClient.incr(key,function(err, id) 
	{
		if(err)
		{
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
	    var state = 0;
	    var roomID = 0;
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
			return new AV.Query('chatUsers').equalTo('userID', request.params.userID).first();
		}).then(function (data)
	    {
	    	if(place < 5)
	    	{
	    		if(data.get('goldNum') < gambling)
	    		{
	    			return AV.Promise.error('金币不足,无法创建房间!');
	    		}
	    		data.increment('goldNum', 0-gambling);
	    	}
	    	else
	    	{
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
		//console.log('检测金币和收获时间异常!');
		clearInterval(timer);
		//checkPetGoldAndGoldMax();
		//saveClientHeart();
		saveGamblingLog();
		return;
	}
 	var key = 'timer60';
 	redisClient.incr(key, function(err, id)
	{
		if(err || id > 1)
		{
			return ;
		}
		redisClient.expire(key, 45);
 		
 		checkPetGoldAndGoldMax();
 		checkPetGmabline();
 		checkPackageLog();
 		//检查用户是否卖钻石和金币
 		checkSaleGold();
 	});
 }, 60000);

var giftSkip = 0;

function checkPetGoldAndGoldMax()
{
	var query = new AV.Query('petInfo');
	query.greaterThan('gold', 150000);
	return query.find().then(function(results)
	{
		//console.log('查询到了', results.length);
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			var date = common.stringToDate(data.get('goldHarvestAt'));
			var goldNum = data.get('goldMax');
			if (goldNum > 150000)
			{
				goldNum = common.getPetGoldMax(data.get('petType'), data.get('level'));
				data.set('goldMax', goldNum);
				data.set('gold', parseInt(goldNum/2));
			}
			else
			{
				data.set('gold', parseInt(goldNum/2));
			}
			if (date - new Date().getTime() > 7 * 86400000)
			{
				var harvestDate = new Date(parseInt( (goldNum * 600000)/ common.getGoldIncrease(data.get('petType'), data.get('level'))));
				data.set('goldHarvestAt', common.FormatDate(harvestDate));

			}
			//console.log('userID:',data.get('userID'));
			//console.log('改正之后数据gold:'+data.get('gold') + 'goldMax'+data.get('goldMax')+'时间:'+ data.get('goldHarvestAt'));
		}
		return AV.Object.saveAll(results);
	});
}

function saveClientHeart()
{
	redisClient.keys('client:*', function(err, keys)
	{
		if(err)
		{
			console.log('error');
		}
		var array = eval(keys);
		for (var i = array.length - 1; i >= 0; i--) {
			var key = array[i];
        		(function(mykey)
        		{
            		redisClient.getAsync(mykey).then(function(value)
          			{
          				if(value)
          				{
          					var info = JSON.parse(value);
          					if(info.online && info.online > 6000)
          					{
          						var object = new clientHeartLog();
          						object.set('key', mykey);
          						object.set('online', info.online);
          						object.save();
          					}
          				}
          			});
          		})(key);
		}
	});
}

function checkSaleGold()
{
	var userIDs = new Array();

	return new AV.Query('openGroupMsg').descending('createdAt').find().then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			var content = data.get('content');
			content.replace(/[\ |\~|\`|\!|\@|\#|\$|\%|\^|\&|\*|\(|\)|\-|\_|\+|\=|\||\\|\[|\]|\{|\}|\;|\:|\"|\'|\,|\<|\.|\>|\/|\?]/g,"");
			if (content.indexOf('卖钻石') >= 0 || content.indexOf('卖砖石') >= 0 || content.indexOf('卖金币') >= 0)
			{
				console.log(content);
				console.log('卖金币钻石封号:'+ data.get('sendUserID'));
				userIDs.push(data.get('sendUserID'));
			}

		}
	});
}

function saveGamblingLog()
{
	redisClient.keys('gamblingLog:*',function (err, keys)
	{
		if(!err)
      	{
        	var array = eval(keys);
        	for (var i = array.length - 1; i >= 0; i--) {
        		var key = array[i];
        		(function(mykey)
        		{
            		redisClient.getAsync(mykey).then(function(value)
          			{
          				if(value)
          				{
          					var gamblingCache = JSON.parse(value);
          					//.push({'userID':userID, 'win':0,'lose':0,'winGold':0,'loseGold':0,
          					//'winDiamond':0,'loseDiamond':0});
          					var object = new gamblingInfo();
          					object.set('userID', gamblingCache.userID);
          					object.set('win', gamblingCache.win);
          					object.set('lose', gamblingCache.lose);
          					object.set('winGold', gamblingCache.winGold);
          					object.set('loseGold', gamblingCache.loseGold);
          					object.set('winDiamond', gamblingCache.winDiamond);
          					object.set('loseDiamond', gamblingCache.loseDiamond);
          					object.set('winL', parseInt(100*gamblingCache.win/(gamblingCache.lose+gamblingCache.win)));
          					object.save();
          				}
            		});
         	 	})(key);
        	}
        }
    });
}
var checkGiftInfo = setInterval(function()
{
	//console.log('定时检测送礼异常!');
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
	});
}, 10000);

var checkPetLog = setInterval(function()
{
	var key = 'timer60';
 	redisClient.incr('timer60:', function(err, id)
	{
		if(err || id > 1)
		{
			return ;
		}
		redisClient.expire(key, 45);

	var query = new AV.Query('petInfoLog');
	query.descending('createdAt')
	query.find().then(function(results)
	{	
		var petArray = {};
		var userIDs = new Array();
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			if (petArray[data.get('petID').toString()] && petArray[data.get('petID').toString()] == 1)
			{
				var has = false;
				for (var j = userIDs.length - 1; j >= 0; j--) {
					if (userIDs[j]==data.get('userID'))
					{
						has = true;
					}				
				}
				if (has == false)
				{
					userIDs.push(data.get('userID'));
				}
				petArray[data.get('petID').toString()] += 1;
			}
			else if(!petArray[data.get('petID').toString()])
			{
				petArray[data.get('petID').toString()] = 1;
			}
		}
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
				log.set('des', '放生日志出错,封号!');
				log.save();
				console.log('放生异常封号' + data.get('userID'));
			}
		});
	}).catch(console.log);
});

}, 60000);

var clearEmptyImg = setInterval(function()
{
	//console.log('定时删除shareImg错误！');
	var query = new AV.Query('shareImg');
	query.limit(1000);
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
		//console.log('清除图片不在的数据!');
	}).catch(function(error)
	{

		//console.log(error);
	});
 }, 7200000);
var clearIntallation = setInterval(function()
{
	var query = new AV.Query('_Installation');
	query.containsAll('channels', ['199']);
	query.limit(1000);
	query.find().then(function(results)
	{
		AV.Object.destroyAll(results);
	});
}, 3600000);
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
	//console.log('joinPetGameQueue'+ parseInt(new Date().getTime()/1000));
	if(request.params.remoteAddress == '114.254.97.89')
	{
		return response.error('查询失败！');
	}
	//并发控制,根据room来控制,一个room只能发起一次请求
	var key = "JoingameRoom:" + request.params.roomID;
	redisClient.incr(key,function( err, id ) 
	{
		if(err || id > 1)
		{
			return response.error('访问频繁!');
		}
		redisClient.expire(key, 2);

		var key2 = "JoinGameUser:" + request.params.userID;
		redisClient.incr(key2, function(err, id)
		{
			if (err || id > 1)
			{
				return  response.error('点的太快了,稍等一下吧!');
			}
			redisClient.expire(key2, 5);
			//存储键值对到魂村服务器
			var win = 0;
			var userID = request.params.userID;
			var otherID = 0;
			var gambling = 0;
			var placeID = 0;
			var goldNum = 0 ;
			var diamond = 0;
			var log = new gamblingLog();
			var logOther = new gamblingLog();
			var room ;
			var gamblingCache = new Array();

			gamblingCache.push({'userID':userID, 'win':0,'lose':0,'winGold':0,'loseGold':0,'winDiamond':0,'loseDiamond':0});
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
				return new AV.Query('gameRoom').equalTo('roomID', request.params.roomID).first();
			}).then(function(data)
			{
				state += '2';
				if(!data)
				{
					return AV.Promise.error('来迟一步,已经被人抢先了!');
				}
				otherID = data.get('userID');
				gamblingCache.push({'userID':otherID, 'win':0,'lose':0,'winGold':0,'loseGold':0,'winDiamond':0,'loseDiamond':0});
				gambling = data.get('gambling');
				placeID = data.get('placeID');
				log.set('userID', userID);
				logOther.set('userID', otherID);
				if(data.get('placeID') == 5)
				{
					diamond = data.get('gambling');
				}
				else
				{
					goldNum = data.get('gambling');
				}
				room = data;
				return redisClient.mgetAsync(['gamblingLog:' + userID, 'gamblingLog:' + otherID]);	
			}).then(function(caches)
			{
				state += '7';
				for (var i = caches.length - 1; i >= 0; i--) 
				{
					if (!caches[i])
					{
						continue;
					}
					var cache = JSON.parse(caches[i]);
					for (var j = gamblingCache.length - 1; j >= 0; j--) {
						if(cache.userID == gamblingCache[j].userID)
						{
							gamblingCache[j] = cache;
						}
					}
				}

				var probability = 50;
				if (goldNum > 0)
				{
					var myWinGold = gamblingCache[0].winGold - gamblingCache[0].loseGold;
					var otherWin = gamblingCache[1].winGold - gamblingCache[1].loseGold;
					if (myWinGold > otherWin)
					{
						probability -= common.getProbility(Math.max(Math.abs(myWinGold), Math.abs(otherWin)), 1);
					}
					else
					{
						probability += common.getProbility(Math.max(Math.abs(myWinGold), Math.abs(otherWin)), 1);
					}
				}
				else
				{
					var winD = gamblingCache[0].winDiamond - gamblingCache[0].loseDiamond;
					var oWinD = gamblingCache[1].winDiamond - gamblingCache[1].loseDiamond;
					if (winD > oWinD)
					{

						probability -= common.getProbility(Math.max(Math.abs(winD), Math.abs(oWinD)), 2);
					}
					else
					{
						probability += common.getProbility(Math.max(Math.abs(winD), Math.abs(oWinD)), 2);
					}
				}
				//console.log("赌博获胜的概率:"+probability);

				var nValue = parseInt(random() * 100);
				if (request.params.newversion == 1 )
				{
					//新版本直接根据结果
					if (nValue <= probability)
					{
						win = 1;
					}
					else
					{
						win = 0;
					}
					if( (userID == 415509) && nValue%5 != 1)
					{
						win = 1;
					}
					if(otherID == 89)
					{
						win = 0;
					}
					log.set('win', win);
					return new AV.Query('chatUsers').containedIn('userID', [userID, otherID]).find();
				}
				else
				{
					state += '3';
					//console.log('返回'+ parseInt(new Date().getTime()/1000));
					response.success(nValue);
					return AV.Promise.error('over');
				}
			}).then(function(results)
			{
				state += '4';

				if(results.length != 2)
				{
					return AV.Promise.error('查询数据有误!');
				}
				state += 'C';
				for (var i = results.length - 1; i >= 0; i--) 
				{
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
					state += 'A';
					if(win == 1)
					{
						logOther.set('win', 0);
						if(object.get('userID') == userID)
						{
							log.set('DiamondQ', object.get('Diamond'));
							log.set('GoldNumQ', object.get('goldNum'));
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
						state += 'B';
						logOther.set('win', 1);
						if(object.get('userID') == userID)
						{
							log.set('DiamondQ', object.get('Diamond'));
							log.set('GoldNumQ', object.get('goldNum'));
							if(diamond > 0)
							{
								object.increment('Diamond', -1*diamond);
							}
							else
							{
								object.increment('goldNum', -1*goldNum);
							}
						}
						else
						{
							logOther.set('DiamondQ', object.get('Diamond'));
							logOther.set('GoldNumQ', object.get('goldNum'));
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
				}
				return AV.Object.saveAll(results);
			}).then(function(results)
			{
				state += '5';
				room.destroy();

				log.set('startUserid', userID);
				log.set('roomID', request.params.roomID);
				log.set('gambling', gambling);
				log.set('placeID', placeID);
				log.set('gameID', 3);
				log.set('otherID', otherID);
				log.set('goldNum', goldNum);
				log.set('Diamond', diamond);


				logOther.set('startUserid', userID);
				logOther.set('roomID', request.params.roomID);
				logOther.set('gambling', gambling);
				logOther.set('placeID', placeID);
				logOther.set('otherID', userID);
				logOther.set('gameID', 3);
				logOther.set('goldNum', goldNum);
				logOther.set('Diamond', diamond);

				log.save();
				logOther.save();

				//console.log('返回'+ parseInt(new Date().getTime()/1000));
				response.success(win);
				
				//存到缓存服务器
				for (var i = gamblingCache.length - 1; i >= 0; i--) {
					if(i == win)
					{
						gamblingCache[i].lose += 1;
						gamblingCache[i].loseGold += goldNum;
						gamblingCache[i].loseDiamond += diamond;
					}
					else
					{
						gamblingCache[i].win += 1;
						gamblingCache[i].winGold += goldNum;
						gamblingCache[i].winDiamond += diamond;
					}
				}
				redisClient.setAsync('gamblingLog:'+userID, JSON.stringify(gamblingCache[0]));
				redisClient.setAsync('gamblingLog:'+ otherID, JSON.stringify(gamblingCache[1]));

			}).catch(function(error) 
			{	
				state += '6';
				//console.log('步骤'+state+error);
				if(error == 'over')
				{
					return 'over';
				}
				return response.error('来迟一步,已经被人抢先了');
			});
		});		
	});
});

//拍卖上架
AV.Cloud.define('upItem', function(request, response)
{
	//console.log('upItem');
	if(request.params.remoteAddress == '114.254.97.89' || request.params.userID == 437163 || 
		request.params.userID == 393308 || request.params.userID == 258818)
	{
		return response.error('查询失败！');
	}
	//数值控制
	if(request.params.gold <= 0 || request.params.itemCount <= 0)
	{
		return response.error('参数有误!');
	}

	var key = 'upItem:' + request.params.userID;
	//并发控制
	redisClient.incr(key, function( err, id ) 
	{
		if(err || id > 1)
		{
			return response.error('上架失败!');
		}
		redisClient.expire(key, 2);

		//全局变量
		var newDay = false;
		var upCache = {};
		var fail = new global.failLog();
		fail.set('IPAddress', request.meta.remoteAddress);
		fail.set('action', '物品上架');
		var bIsOver = false;
		//检查是否已经被封禁
		redisClient.getAsync('forbiddenUserID').then(function(cacheUser)
		{
			if(cacheUser)
			{
				//console.log(cacheUser);
				var array = cacheUser.split(",");
				for (var i = array.length - 1; i >= 0; i--) {
					if(request.params.userID == array[i])
					{
						bIsOver = true;
						return response.error('上架失败!');
					}
				}
			}
			return redisClient.getAsync('token:' + request.params.userID);
		}).then(function(cache)
		{	
			if (bIsOver == true)
			{
				return ;
			}
			if(!cache || cache != request.params.token)
			{
				if(global.isReview == 0)
				{
					return AV.Promise.error('访问失败!');
				}
			}
			//无需判断次数,直接扣除手续费
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
			//obj.set('floorPrice', request.params.price);
			obj.set('gold', request.params.gold);
			obj.set('itemName', request.params.name);
			obj.set('ownerName', request.params.ownerName);
			if(request.params.otherName)
			{
				obj.set('otherName', request.params.otherName);
			}
			if(request.params.buyer)
			{
				obj.set('buyer', request.params.buyer);
			}
			obj.fetchWhenSave(true);
			return obj.save();
		}).then(function(obj)
		{
			//redisClient.setAsync('upItemLimit:'+request.params.userID, JSON.stringify(upCache));
			fail.set('step', 3);
			var log = new acutionLog();
			log.set('ownerID', obj.get('ownerID'));
			log.set('acutionID', obj.get('auctionID'));
			log.set('buyFor', "上架");
			//log.set('floorPrice', obj.get('floorPrice'));
			log.set('gold', obj.get('gold'));
			log.set('itemID', obj.get('itemID'));
			log.set('itemCount', obj.get('itemCount'));
			log.set('otherName', obj.get('otherName'));
			log.set('buyer', obj.get('buyer'));
			log.save();
			var auctionID = obj.get('auctionID');
			
			return response.success(auctionID);
		}).catch(function(error)
		{
			if (error == 'over')
			{
				return;
			}
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
	//console.log('buyItem');
	if(request.params.remoteAddress == '114.254.97.89'
	|| request.params.remoteAddress == '183.167.204.161' || request.params.buyer == 437163 || 
	request.params.buyer == 393308 || request.params.buyer == 258818)
	{
		return response.error('error');
	}
	var reqData = request.params;
	var key = 'buyItem:'+ request.params.auctionID;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		if(err || id > 1)
		{
			return response.error('购买失败!');
		}
		redisClient.expire(key, 2);

		var log = new moneyLog();
		var fail = new global.failLog();
		fail.set('action', '购买物品');
		fail.set('auctionID', reqData.auctionID);
		fail.set('userID', reqData.buyer);
		fail.set('IPAddress', request.meta.remoteAddress);
		log.set('des', "交易中心购买");

		var bIsOver = false;
		var diamond = 0;
		var buyer = 0;
		var price = 0;
		//检查是否已经被封禁
		redisClient.getAsync('forbiddenUserID').then(function(cacheUser)
		{
			if(cacheUser)
			{
				var array = cacheUser.split(",");
				for (var i = array.length - 1; i >= 0; i--) {
					if(reqData.buyer == array[i])
					{
						bIsOver = true;
						return response.error('购买失败!');
					}
				}
			}
			return redisClient.getAsync('token:' + reqData.buyer);
		}).then(function(cache)
		{	
			if (bIsOver == true)
			{
				return AV.Promise.error('over');
			}
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
			diamond = data.get('gold');
			auctionItem = data;

			if(reqData.owner == reqData.buyer)
			{
				return AV.Promise.as('The good result.');
			}
			if (reqData.price && reqData.price > 0)
			{
				return AV.Promise.error('无法购买,只能购买金币上架物品!');
			}

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
					log.set('goldBefore', obj.get('goldNum'));
					obj.increment('goldNum', parseInt(diamond * 0.9));
					log.set('goldIncrease', parseInt(diamond * 0.9));
				}
				else
				{
					if(obj.get('goldNum') < diamond)
					{
						log.set('othergoldBefore', obj.get('goldNum'));
						//response.error('钻石数量不足!');
						return AV.Promise.error('金币数量不足!');
					}
					obj.increment('goldNum', -1 * diamond);
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
			response.success({'price':parseInt(diamond * 0.9)});
			if(reqData.owner != reqData.buyer)
			{
				log.save();
			}
			
		}).catch(function(error)
		{
			if (error == 'over')
			{
				return;
			}
			fail.set('errorInfo', error);
			fail.save();
			response.error(error);
		});	
	});
});

//拍卖上架
AV.Cloud.define('silverChange', function(request, response)
{
	//console.log('silverChange');
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
		if(error || id > 1)
		{
			return response.error("兑换冷却中(每次兑换需要间隔6个小时)!");
		}
		redisClient.expire(key, 2);

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
			
				return AV.Promise.error('There was an error.');
			
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
  var uuid = request.params.uuid;
  var clientIP = request.meta.remoteAddress;
  var token = request.params.token;
  var deviceName = request.params.deviceName;
  var realToken = '';
  redisClient.getAsync('saveUUID:'+uuid).then(function(cache)
  {
  	if(!cache)
  	{
  		redisClient.setAsync('saveUUID:'+uuid, JSON.stringify({state:0, date:common.FormatDate(new Date())}));
  	}
  });

  //此时保存一下UUID
  redisClient.setAsync("UUID:"+request.params.userID, uuid).catch(function(error)
	{
		//console.log('保存UUID失败!');
	});

  object.set('IPAddress', clientIP);
  object.set('userid', request.params.userID);
  object.set('version', request.params.version);
  object.set('hack', request.params.hack);
  object.set('clientToken', token);
  object.set('UUID', uuid);
  object.set('deviceName', deviceName);
  redisClient.getAsync('token:'+ request.params.userID).then(function(cache)
  {
  	if(cache)
  	{
  		realToken = cache;
  	}
  	object.set('serverToken', realToken);
  	object.save();
  }).catch(function(error)
  {
  	object.save();
  });
  response.success();
});

AV.Cloud.define('sealAccount', function(request, response) 
{
	//console.log('sealAccount');
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
	//console.log('checkAccount');
	var uuid = request.params.uuid||'1234567';
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
	//console.log('petRankFight');
	var req = reqCount();
	var key = "petRank:" + request.params.petID;
	var key2 = 'petRank:' + request.params.otherID;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		if(err || id > 1)
		{
			return response.error('宠物正在被挑战!');
		}
		redisClient.expire(key, 300);
		redisClient.incr(key2, function(err, id)
		{
			redisClient.expire(key2, 300);
			if(err || id > 1)
			{
				return response.error('金币不足');
			}
			return response.success('success');
		});
	});
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
var gold = [0, 50, 70, 150, 250, 400, 700, 900, 1200, 1500, 2000];
//var gold = [0, 50, 70, 120, 250, 370, 540, 750, 850, 1100, 1400];
var charm = [0, 5, 15, 40, 80, 180, 300, 450, 600, 700, 800];
var plantName = ['','萝卜','胡萝卜','橙子','南瓜','小麦','雏菊','葡萄','西瓜','玉米','康乃馨'];
AV.Cloud.define('harvestPlant',function(request, response)
{
	//console.log('harvestPlant');
	if(request.params.remoteAddress == '114.254.97.89' || request.params.remoteAddress == '183.167.204.161')
	{
		return response.error('error');
	}

	var key = 'Plant:'+ request.params.buildingNo;
	redisClient.incr(key, function(error, id)
	{
		if(error || id > 1)
		{
			return response.error('收取失败!');
		}
		var userID = request.params.userID;
		var goldCount = 0;
		var charmCount = 0;
		var user = 0;
		var diamond = 0;
		var plantID  = 0;
		var count = 0;
		var log = new plantLog();
		return redisClient.getAsync('Plant='+request.params.uuid).then(function(cache)
		{
			var userIDs = new Array();
			var has = false;
			if (cache)
			{
				userIDs = cache.split(",");
				for (var i = userIDs.length - 1; i >= 0; i--) 
				{
					if (userIDs[i] == userID)
					{
						has = true;
					}
				}
				if (has == false && userIDs.length < 3)
				{
					userIDs.push(userID);
					has = true;
				}
			}
			else
			{
				userIDs.push(userID);
				has = true;
			}
			redisClient.setAsync('Plant='+request.params.uuid, userIDs.join(','));
			if (has)
			{
				return new AV.Query('building').equalTo('buildingNo', request.params.buildingNo).first();
			}
			else
			{
				return new AV.Query('building').equalTo('userID', -1).first();
			}
		}).then(function(data)
		{
			if(!data || data.get('plant') == 0 || data.get('userID') != userID)
			{
				console.log(request.params.buildingNo);
				console.log(data);
				return AV.Promise.error('查询失败!');
			}
			plantID = data.get('plant');
			var second = new Date().getTime()/1000;
			var plantTime = data.get('plantTime') + (plantID * 8 + 4)*3600;
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
	            if (parseInt(Math.random() * 1000) % 5 ==0)
	            {
	                diamond = parseInt(Math.random() * 1000) % 20 + 1;
	            }
	        }

	        log.set('plant', data.get('plant'));
	        log.set('userID', data.get('userID'));
	        log.set('field', data.get('floorID'));
	        log.set('plantTime', data.get('plantTime'));
	        log.set('nowTime', parseInt(new Date().getTime()/1000));
	        log.set('plantCount', data.get('plantCount'));
	        log.save();

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
			redisClient.delAsync(key);
			response.error(error);
		});
	});
});

AV.Cloud.define('recoveryBuilding',function(request, response)
{
	//console.log('recoveryBuilding');
	var req = reqCount();
	var key = 'Recovery:'+ request.params.buildingNo;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		if(err || id > 1)
		{
			return response.error('回收失败!');
		}
		redisClient.expire(key, 2);
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
		}).then(function(success)
		{
			response.success({'diamond':diamond,'gold':gold});
		}).catch(function(error)
		{
			response.error(error);
		});
	});
});

//偷取植物
AV.Cloud.define('stealPlant',function(request, response)
{
	//console.log('stealPlant');
	var req = reqCount();
	key = 'steal:'+request.params.buildingNo;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		if(err || id > 1)
		{
			return response.error('偷取失败!');
		}
		redisClient.expire(key, 2);

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
			{
				return AV.Promise.error('error');
			}
			data.increment('plantCount', parseInt(-1 * stealCount));
			charmIncrease = charm[data.get('plant')] * parseInt(stealCount);
			hostUser = data.get('userID');
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
	//console.log('renewDecoration');	
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
	//console.log('sendGift');
	if(request.params.remoteAddress == '114.254.97.89'
		|| request.params.remoteAddress == '183.167.204.161' || request.params.userID == 437163
		|| request.params.userID == 393308 || request.params.userID == 258818)
	{
		return response.error('查询失败!');
	}
	var boxGift = [890,26,89,21,88,480];
	var forbiddenUsers = [];

	var userID = request.params.userID;
	var giftID = request.params.giftID;

	if (giftID == 26 || giftID == 89 || giftID == 890)
	{
		return response.error('查询失败!');
	}

	//控制固定用户无法送箱子
	if (forbiddenUsers.indexOf(userID) >= 0 && boxGift.indexOf(giftID) >= 0)
	{
		return response.error('查询失败!');
	}

	var toID = request.params.toID;
	var log = new GiftSendLog();
	var vipprice = [1.0,0.9,0.85,0.8,0.75,0.7,0.65,0.6,0.55,0.5,0.45,0.45,0.45];
	var step = 0;
	var gift = new AV.Object(JSON.parse(giftInfo[request.params.giftID]), {parse: true});
	var toUserName = '';
	var goldSend = 0;
	var diamondSend = 0;
	var loverIncrease = 1.0;
	var key = "sendGift:" + userID;

	//并发控
	redisClient.incr(key,function( err, id ) 
	{
		redisClient.expire(key, 2);
		if(err || id > 1)
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
			if (needGold > 0 && data.get('goldNum') < needGold)
			{
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
					data.increment('dailyUseGold', needGold + needDiamond * 100);
				}
				else
				{
					data.set('dailyUseGold', needGold + needDiamond * 100);
					data.set('dailyUseGoldAt', new Date());
				}
				data.increment('useGold', needGold + needDiamond * 100);
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
			//console.log('GiftRecv'+toID+"gift:"+giftID);
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
			//console.log('giftSend'+userID+"gift:"+giftID);
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
			//console.log('送礼失败:'+error);
			log.save();
			response.error(error);
		});
	});
});


AV.Cloud.define('endMarriage', function(request, response)
{
	//console.log('endMarriage');
	var userID = request.params.userID;
	var other = 0;
	var key = 'endMarriage:'+request.params.userID;
	redisClient.incr(key, function(err, id)
	{
		if(err || id > 1)
		{
			return response.success({'gold':0});
		}
		redisClient.expire(key, 60);
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
	//console.log('useChestBatch');
	var req = reqCount();
	var reqKey = "useChest:" + request.params.userID;
	var petID = request.params.petID;
	//并发控制
	redisClient.incr(reqKey,function( err, id ) 
	{
		if(err || id > 1)
		{
			return response.error('访问太过频繁!');
		}
		redisClient.expire(reqKey, 2);
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
			if(count > 10)
			{
				count = 10;
			}

			if(itemID > 11 && itemID < 16)//批量使用道具,累加所有增长
			{
				for (var i = count - 1; i >= 0; i--) 
				{
					plus += random() + 0.1;
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
				var bookCount = Math.floor(data.get('level')/10 + 1) * 100;
				if(data.get('attackBook') >= bookCount)
				{
					return AV.Promise.error('使用失败,可使用次数不足!!');
				}
				data.increment('attackBook', -1 * saveDatas[itemID]);
				data.increment('attackPlus', parseInt(10 * plus));

				saveObjects.push(data);
				return AV.Object.saveAll(saveObjects);
			}
			else if (itemID == 13)
			{
				var bookCount = Math.floor(data.get('level')/10 + 1) * 50 + saveDatas[itemID];
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
				var bookCount = Math.floor(data.get('level')/10 + 1) * 50 + saveDatas[itemID];
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
				var bookCount = Math.floor(data.get('level')/10 + 1) * 30 + saveDatas[itemID];
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

//console.log('composeItem');
	if(request.params.remoteAddress == '114.254.97.89'
		|| request.params.remoteAddress == '183.167.204.161')
	{
		return response.error('error');
	}
	var key = "upItem:" + request.params.userID;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		if(err || id > 1)
		{
			return response.error('访问太过频繁!');
		}
		redisClient.expire(key, 2);

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
			console.log(error);
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
	//console.log('useItem');
	if(req.params.remoteAddress == '114.254.97.89'
		|| req.params.remoteAddress == '183.167.204.161')
	{
		return res.error('error');
	}

	var key = "upItem:" + req.params.userID;
	//并发控制
	redisClient.incr(key,function( err, id ) 
	{
		if(err || id > 1)
		{
			return res.error('访问太过频繁!');
		}
		redisClient.expire(key, 2);
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
			else if(item == 25 || item == 28 || item == 20 || item == 21)
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
				newItem = item+1;
				data.destroy();
				saveObj.push(data);
				return new AV.Query('chatUsers').equalTo('userID', req.params.userID).first();
			}
		}).then(function(data)
		{
			//开启宝箱
			if(item >= 30 && item <= 38)
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
			else if(item == 20)
			{
				if (data.get('badNum') <= 0)
				{
					return AV.Promise.error('使用失败,你没有差评可以消除!');
				}
				data.increment('badNum', -1);
				saveObj.push(data);
				return AV.Object.saveAll(saveObj);
			}
			else if(item == 21)
			{
				if (data.get('canUseVIP') == 1)
				{
					//return AV.Promise.error('你已经体验过VIP了,无法再次体验!');
				}
				data.set('canUseVIP', 1);
				var vipDate = common.stringToDate(data.get('VIPDay'));
				vipType = common.getVipType(data.get('BonusPoint'));
				if(vipType == 0)
				{
					vipType = 1;
				}
				if (data.get('BonusPoint') == 0)
				{
					data.set('BonusPoint', 1);
				}
				//如果是续费,无需改动
				if(common.checkDayGreater(vipDate, new Date()))
				{

					data.set('VIPDay', common.FormatDate(new Date(vipDate.getTime()+86400000 * 7)));
				}
				else
				{
					data.set('VIPDay', common.FormatDate(new Date(new Date().getTime()+86400000 * 7)));
				}
				data.set('VIPType', vipType);
				saveObj.push(data);
				return AV.Object.saveAll(saveObj);
			}
			else//使用金蛋
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
			if(newItem < 0)
			{
				res.success({'itemID':newItem,'charm':meili});
				return AV.Promise.error('success');
			}
			else if (item >= 30 && item <= 38)
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
			else
			{
				return AV.Promise.as('success');
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
		});
	});
});

AV.Cloud.define('clientHeart', function(req, response)
{
	//console.log('clientHeart');
	var userID = req.params.userID;
	var version = req.params.version;
	redisClient.getAsync('token:' + userID).then(function(cache)
  	{
    	if(!cache || cache != req.params.token)
    	{
    		 //评价人的令牌与userid不一致,删掉token,让用户重新登录
    		 redisClient.delAsync(req.params.token);
     		if (global.isReview == 0)
     		{
     	  		return AV.Promise.error('token');
     	 	}
    	}
		return redisClient.getAsync(clientKey(userID));
	}).then(function(cache)
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
							return response.success('appstore');
						}
					}
					else
					{
						return response.success('appstore');
					}

				}
				else
				{
					//console.log(data);
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
	//console.log('userEvaluate');
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
		//console.log('保存UUID失败!');
	});
	response.success('');
});

AV.Cloud.define('getDeviceRight', function(request, response)
{
	var userID = request.params.userID;
	var uuid = request.params.uuid;
	redisClient.getAsync("UUID:" + userID).then(function(cache)
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
		else
		{
			return response.success('success');
		}
	}).catch(function(error)
	{
		return response.success('success');
	});
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
	//console.log('getGroupInfo');
	redisClient.keys(groupKey('*','*'), function (err, keys)
	{
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
    response.success('');
});

AV.Cloud.define('dealSomething', function(request, response)
{
});

AV.Cloud.define('endMarriageNoGold', function(request, response)
{
	//console.log('endMarriage');
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

AV.Cloud.define('WeChatPreOrder', function(request, response)
{
	console.log('wechatOrder');
	var wxpay = WXPay({
    appid: 'wxf3633e02a28d60f0',
    mch_id: '1364004502',
    partner_key: 'jiudianZxcvbnmDSAD1weqwkj89991oo' //微信商户平台API密钥
  });
  //客户端IP
  var clientIP = request.meta.remoteAddress;
  var fee = 0;
  var type = request.params.type;
  var fee = request.params.fee * 100;
  var userid = request.params.userid;
  var notifyurl = 'http://asplp.leanapp.cn/wxpay/notify';
  if (process.env.LEANCLOUD_APP_ENV == 'stage') 
  {
    notifyurl ='http://stg-asplp.leanapp.cn/wxpay/notify';
    fee = 1;
  }
  var date = new Date();

  var orderData = 
  {
    appid:'wxf3633e02a28d60f0',
    body:'有朋余额充值',
    mch_id:"1364004502",
    total_fee:fee,
    notify_url:notifyurl,
    out_trade_no: Math.floor((date.getTime() + Math.random()) * 1000).toString(),
    nonce_str:util.generateNonceString(),
    attach:userid.toString(), 
    spbill_create_ip: clientIP,
    trade_type:'APP'
  }

  wxpay.createUnifiedOrder(orderData, function(err, result)
  {
    //response.success(result);
    if(result.return_code == 'SUCCESS')
    {
      
      result.timestamp = date.getTime()/1000;
      var retData = {
        appid: 'wxf3633e02a28d60f0',
        noncestr: result.nonce_str,
        partnerid: '1364004502',
        prepayid: result.prepay_id,
        timestamp: parseInt(date.getTime()/1000),
        package: 'Sign=WXPay',
        sign: ''
      }
      retData.sign = wxpay.sign(retData);
      //console.log(retData);
      //返回预付单号
      response.success(retData);
      //写入数据库
      var order = new WeChatOrder();
      //记录订单号
      order.set('tradeNo', orderData.out_trade_no);
      //记录用户id
      order.set('userID', userid);
      //记录订单状态 0-下单
      order.set('orderState', 0);
      //记录购买物品
      order.set('needFee', fee / 100);
      order.set('type', 10);
      order.set('des', '钱包余额');
      order.save();
    }
    else
    {
      response.error(result.return_msg);
    }
    //console.log("统一下单结果:",result);
});
});

function getOrderNumber()
{
	var order = '';
	order += parseInt(new Date().getTime()/1000);
	order += util.generateNonceString(15 - order.length);
	return order;
}
AV.Cloud.define('AliPayOrder', function(request, response)
{
  	var orderNum = getOrderNumber();
  	var fee = request.params.fee;
  	var type = request.params.type;
  	var order = new alipayOrder();

  	var notifyurl = 'http://asplp.leanapp.cn/alipay';
  	if (process.env.LEANCLOUD_APP_ENV == 'stage') 
  	{
  	//	fee = 0.01;
    	notifyurl ='http://stg-asplp.leanapp.cn/alipay';
  	}

  	//记录购买物品
    order.set('needFee', fee);
    order.set('type', type);
  	order.set('orderState', 0);
  	order.set('tradeNo', orderNum);
  	order.set('userID', request.params.userID);
  	order.save();

  	var reqData = 
  	{
  		app_id:'2016071301613150',
  		method:'alipay.trade.app.pay',
  		charset:'utf-8',
  		timestamp:common.FormatDate(new Date()),
  		version:'1.0',
  		sign_type:'RSA',
  		notify_url:notifyurl,
  		biz_content:'{\"timeout_express\":\"30m\",\"seller_id\":\"\",\"product_code\":\"QUICK_MSECURITY_PAY\",\"total_amount\":\"'+fee+'\",\"subject\":\"有朋充值\",\"body\":\"有朋充值\",\"out_trade_no\":\"'+orderNum+'\"}'
  	}
	var realstring = common.JointJson(reqData, false);
	var encodeString = common.JointJson(reqData, true);

	console.log(realstring);
	console.log(encodeString);
	var privatePem = fs.readFileSync('config/rsa_private_key_pkcs8.pem');
	var prikey = privatePem.toString();

	var sign = crypto.createSign('RSA-SHA1');
	sign.update(realstring, 'utf8');
	sig = sign.sign(prikey);

	var resultStr = encodeString + '&sign=' + encodeURIComponent(sig.toString('base64'));
	response.success({'orderString':resultStr});
});

AV.Cloud.define('petJoinFight', function(request, response)
{
	return response.success('');
	var petID = request.params.petID;
	var userID = request.params.userID;
	var vitality = request.params.vitality;
	if (vitality < 5)
	{
		vitality = 5;
	}
	redisClient.incr("petFight:" + petID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('petFight:' + petID, 1);
		return new AV.Query('petInfo').equalTo('petID', petID).first().then(function(data)
		{
			if (!data || data.get('vatility') < vitality)
			{
				return AV.Promise.error('体力不足!');
			}
			data.increment('vatility', -1*vitality);
			return data.save();
		}).then(function(success)
		{
			return response.success('');
		}).catch(function(error)
		{
			return response.error(error);
		});
	});
});

AV.Cloud.define('petBuyVitality', function(request, response)
{
	var userID = request.params.userID;
	var petID = request.params.petID;
	var type = request.params.type;
	if (type != 1 && type != 2)
	{
		return response.error('参数错误!');
	}
	redisClient.incr("petBuyVitality:" + petID, function(err, id)
	{
		if(err || id > 1)
		{
			return response.error('访问频繁');
		}
		redisClient.expire('petBuyVitality:' + petID, 1);
		var saveObjs = new Array();
		var count = 0;
		var needDiamond = 5;
		var vitality = 50;
		if (type == 2)
		{
			vitality = 120;
			needDiamond = 10;
		}
		return new AV.Query('petInfo').equalTo('petID', petID).first().then(function(data)
		{
			if (!data || data.get('userID') != userID)
			{
				return AV.Promise.error('购买异常!');
			}
			var date = data.get('buyValityAt');
			if (date && common.checkDaySame(new Date(), date))
			{
				count = data.get('buyVality');
				//if (count >= 5)
				//{
				//	return AV.Promise.error('可购买次数不足,每天限制为5次!');
				//}
				data.increment('buyVality', 1);
			}
			else
			{
				data.set('buyVality', 1);
			}
			data.set('buyValityAt', new Date());
			data.increment('vatility', vitality);
			saveObjs.push(data);
			return new AV.Query('chatUsers').equalTo('userID', data.get('userID')).first();
		}).then(function(data)
		{
			if (!data)
			{
				return AV.Promise.error('用户信息查询失败!');
			}
			
			needDiamond *= count + 1;

			if (data.get('Diamond') < needDiamond)
			{
				return AV.Promise.error('钻石不足,无法购买体力!');
			}
			data.increment('Diamond', -1 * needDiamond);
			saveObjs.push(data);
			return AV.Object.saveAll(saveObjs);
		}).then(function(success)
		{
			count += 1;
			return response.success({'Diamond':needDiamond,'vitality':vitality, 'count':count});
		}).catch(function(error)
		{
			return response.error(error);
		});
	});
});

AV.Cloud.define('canJoinPet', function(request, response)
{
	var userID = request.params.userID;
	var uuid = request.params.uuid;
	return redisClient.getAsync('JoinPet='+request.params.uuid).then(function(cache)
	{
		var userIDs = new Array();
		var has = false;
		if (cache)
		{
			userIDs = cache.split(",");
			for (var i = userIDs.length - 1; i >= 0; i--) 
			{
				if (userIDs[i] == userID)
				{
					has = true;
				}
			}
			if (has == false && userIDs.length < 3)
			{
				userIDs.push(userID);
				has = true;
			}
		}
		else
		{
			userIDs.push(userID);
			has = true;
		}
		redisClient.setAsync('JoinPet='+uuid, userIDs.join(','));
		if (has == false)
		{
			response.error('error');
		}
		else
		{
			response.success('');
		}
	});
});

AV.Cloud.define('invitation', function(request, response)
{
	var code = request.params.code;
	var uuid = request.params.uuid;
	var saveObj = {};
	redisClient.incr('invitation:' + uuid, function(err, id)
	{
		if (err || id > 1)
		{
			return response.error('访问频繁');
		}	
		redisClient.expire('invitation:' + uuid, 1);
		redisClient.getAsync('saveUUID:'+uuid).then(function(cache)
		{
			if (cache)
			{
				saveObj = JSON.parse(cache);
				var date = common.stringToDate(saveObj.date);
				if (saveObj.state != 0)
				{
					return AV.Promise.error('该设备已经填写过邀请码了!');
				}
				//一天之后就不算是新号了
				if (common.checkDaySame(date, new Date()) == false)
				{
					return AV.Promise.error('该设备已经登录过其他用户,无法获得邀请奖励!');
				}
				saveObj.state = 1;
			}
			saveObj.state = 1;
			saveObj.date = common.FormatDate(new Date());
			var query1 =  new AV.Query('chatUsers').equalTo('invitationCode', code);
			var query2 = new AV.Query('chatUsers').equalTo('userID', request.params.userID);
			return AV.Query.or(query1, query2).find();
		}).then(function(results)
		{
			if (results.length != 2)
			{
				return AV.Promise.error('查询用户信息失败失败!');
			}
			for (var i = results.length - 1; i >= 0; i--) {
				var data = results[i];
				if (data.get('userID') != request.params.userID)
				{
					if (data.get('bAlreadyYQ') >= 10)
					{
						return AV.Promise.error('对方领取奖励次数已经达到上限!');
					}
					data.increment('bAlreadyYQ', 1);
				}
				data.increment('Diamond', 20);
			}
			return AV.Object.saveAll(results);
		}).then(function(data)
		{
			redisClient.setAsync('saveUUID:'+uuid, JSON.stringify(saveObj));
			response.success('');
		}).catch(function(error)
		{
			return response.error(error);
		});
	});
});

AV.Cloud.define('soldPackageItem', function(request, response)
{
	var userID = request.params.userID;
	var itemID = request.params.itemID;
	var key = "upItem:" + request.params.userID;
	var silver =  0;
	var log = new silverLog();
	redisClient.incr(key, function(err, id)
	{
		if(id > 1)
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
			return new AV.Query('package').equalTo('userID', userID).equalTo('itemID', itemID).first();
		}).then(function(data)
		{
			if (!data)
			{
				return AV.Promise.error('该物品已经没有了,请刷新包裹重试!');
			}
			silver = common.getItemPrice(itemID) * data.get('itemCount');
			if (silver < 1)
			{
				return AV.Promise.error('该物品无法回收,请稍后再试!');
			}
			log.set('userID', userID);
			log.set('itemID', itemID);
			log.set('itemCount', data.get('itemCount'));
			log.set('silverIncrese', silver);
			log.set('step', 0);
			return data.destroy();
		}).then(function(scuccess)
		{
			log.set('step', 1);
			return new AV.Query('chatUsers').equalTo('userID', userID).first();
		}).then(function(data)
		{
			if (!data)
			{
				return AV.Promise.error('查询用户信息失败!');
			}
			log.set('beforeSilver', data.get('silverCoin'));
			data.increment('silverCoin', silver);
			data.fetchWhenSave(true);
			return data.save();
		}).then(function(data)
		{
			log.set('step', 2);
			log.set('afterSilver', data.get('silverCoin'));
			log.save();
			response.success({'silver':silver});
		}).catch(function(error)
		{
			log.save();
			response.error(error);
		});
	});
});

AV.Cloud.define('createWolfKillRoom', function(request, response)
{
	var obj = new wolfKill;
	obj.set("userID", request.params.userID);
	obj.set('count', request.params.count);
	obj.set('second', request.params.second);
	obj.set('groupID', request.params.groupID);
	obj.set('title', request.params.title);
	obj.set('passwd', request.params.passwd);
	obj.set('god', request.params.god.join(','));
	obj.fetchWhenSave(true);
	obj.save().then(function(data)
	{
		response.success(data.get('roomID'));
		var cache = {roomID:data.get('roomID'), count:data.get('count'), gold:data.get('god'), step:0, second:data.get('second')};
		//存入缓存服务器
		redisClient.set('wolfKillInfo:' + data.get('roomID'), JSON.stringify(cache));
	});
});



module.exports = AV.Cloud;