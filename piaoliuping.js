var AV = require('leanengine');
//var reqCount = require('./reqCount');
global.reqCenter = {};
function reqCount()
{
	return global.reqCenter;
}
var redisClient = require('./redis').redisClient;

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
var package = AV.Object.extend('package');
var giftInfo = {};
var seedrandom = require('seedrandom');
initGiftInfo();

//创建赌场房间
AV.Cloud.define('createGameRoom', function(request, response) 
{
	//并发控制
	var req = reqCount();
	var key = "1," + request.params.userID;
	if(req[key])
	{
		if(req[key] > 0)
		{
			return response.error("请求过于频繁!");
		}
	}
	req[key] = 1;

	var log = new gameRoomLog();
    log.set('userID', request.params.userID);
    log.set('gambling', request.params.gambling);
    log.set('placeID', request.params.place);
    log.set('gameID', request.params.game);
    log.set('roomTitle', request.params.title);
    var gambling = request.params.gambling;
	if(gambling <= 0)
	{
		req[key] = 0;
		delete req[key];
		return response.error('参数错误!');
	}
	var place = request.params.place;
	var query = new AV.Query('chatUsers');
    query.equalTo('userID', request.params.userID);
    var state = 0;
    var roomID = 0;
    query.first().then(function (data)
    {
    	if(place < 5)
    	{
    		if(data.get('goldNum') < gambling)
    		{
    			//response.error('金币不足!');
    			//并发控制解除
    			req[key] = 0;
				delete req[key];
    			return AV.Promise.error('金币不足');
    		}
    		data.increment('goldNum', 0-gambling);
    	}
    	else
    	{
    		if(data.get('Diamond') < gambling)
    		{
    			//并发控制解除
    			req[key] = 0;
				delete req[key];
    			return AV.Promise.error('钻石不足');
    		}
    		data.increment('Diamond', 0-gambling);
    	}
    	//data.fetchWhenSave(true);
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

    	console.log('创建房间',request.params);
   		//并发控制解除
    	req[key] = 0;
		delete req[key];
		return response.success('创建成功!');
    }).catch(function(error)
    {
    	log.set('state', state);
    	log.save();
    	//并发控制解除
    	req[key] = 0;
		delete req[key];
		return response.error('创建成功!');
    });
    
});
//挑战异常检测
 var timer = setInterval(function() 
 {
 	if (process.env.LEANCLOUD_APP_ENV == 'stage') 
 	{
 		return ;
 	}
 	console.log('1分钟一次定时异常检测!');
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
				console.log(room[key]);
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
				data.set('forbiddenState', 1);
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
	});
 }, 60000);

AV.Cloud.define('saveDailyLikeLovers', function(request, response)
{
	//console.log('存储排行数据');
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
	},function(error)
	{
		response.error('失败!');
	});
});

//挑战房间
AV.Cloud.define('joinPetGameQueue', function(request, response)
{
	//并发控制,根据room来控制,一个room只能发起一次请求
	var req = reqCount();
	var key = "gameRoom," + request.params.roomID;
	if(req[key])
	{
		if(req[key] > 0)
		{
			return response.error("晚了一步!");
		}
	}
	req[key] = 1;
	//存储键值对到魂村服务器
	console.log('joinpetRoom:',request.params.roomID);
	var win = 0;
	var userID = request.params.userID;
	var otherID = 0;
	var gambling = 0;
	var placeID = 0;
	var goldNum = 0 ;
	var diamond = 0;
	return new AV.Query('gameRoom').equalTo('roomID', request.params.roomID).first().then(function(data)
	{
		if( !data)
		{
			return AV.Promise.error('There was an error.');
		}
		otherID = data.get('userID');
		gambling = data.get('gambling');
		placeID = data.get('placeID');
		if(data.get('placeID') == 5)
		{
			diamond = data.get('gambling');
		}
		else
		{
			goldNum = data.get('gambling');
		}
		return data.destroy();
	}).then(function(success)
	{
		var nValue = parseInt(Math.random()*10);
		console.log(nValue);
		if (request.params.newversion == 1 )
		{
			//新版本直接根据结果
			if(nValue%2 == 1 || 406268 == userID)
			{
				win = 1;
			}
		return new AV.Query('chatUsers').containedIn('userID', [userID, otherID]).find();
		}
		else
		{
			response.success(nValue);
			req[key] = 0;
			delete req[key];
			return AV.Promise.error('over');
		}
		
	}).then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			if(win == 1)
			{
				if(data.get('userID') == userID)
				{
					if(diamond >0)
					{
						data.increment('Diamond', diamond);
					}
					else
					{
						data.increment('goldNum', goldNum);
					}
				}
			}
			else
			{
				if(data.get('userID') == userID)
				{
					if(diamond > 0)
					{
						data.increment('Diamond', -1*diamond);
					}
					else
					{
						data.increment('goldNum', -1*goldNum);
					}
				}
				else
				{
					if(diamond > 0)
					{
						data.increment('Diamond', 2*diamond);
					}
					else
					{
						data.increment('goldNum', 2*goldNum);
					}
				}

			}
		}
		return AV.Object.saveAll(results);
	}).then(function(success)
	{
		var log = new petGamblingLog();
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
		delete req[key];

	}).catch(function(error) 
	{
		if(error == 'over')
		{
			return;
		}
		response.error(error);
		req[key] = 0;
		delete req[key];
  	});
});

AV.Cloud.define('SavePetGameInfo',function(request, response)
{
	var key = 'savePetGame' + request.params.roomID;
	if(req[key] && req[key] > 0)
	{
		return response.error('出错!');
	}
	req['savePetGame'+request.params.roomID] = 1;
	redisClient.getAsync('petGameJoin'+request.params.roomID).then(function(cache)
	{
		if(cache)
		{
			var petGame = JSON.parse(cache);
			if(petGame.userID != request.params.userID)
			{
				req[key] = 0;
				delete req[key];
				return response.error('出错');
			}
			var query1 = new AV.Query('chatUsers');
  			query1.equalTo('userID', petGame.userID);

  			var query2 = new AV.Query('chatUsers');
  			query2.equalTo('userID', reqData.ownerID);

  			var goldNum = 0; var diamond = 0; var gambling = petGame.gambling;
  			if(petGame.place < 5)
  				goldNum = petGame.gambling;
  			else
  				diamond = petGame.gambling;

  			redisClient.delAsync('petGameJoin'+ request.params.roomID).then(function(data)
			{
				AV.Query.or(query1, query2).find().then(function(results)
			{
				for (var i = results.length - 1; i >= 0; i--) {
					var data = results[i];
					if(data.get('userID') == request.params.winnerID)
					{
						data.increment('goldNum',goldNum);
						data.increment('Diamond',diamond);
					}
					else
					{
						data.increment('goldNum', -1*goldNum);
						data.increment('Diamond',-1*diamond);
					}
					//return data.save();
				}
				return AV.Object.SaveAll(results);
			}).then(function(data){
				
				var log = new petGamblingLog();
				log.set('gambling', gambling);
				log.set('roomID', request.params.roomID);
				log.set('winnerID', requst.params.winnerID);
				log.set('loserID', requst.params.loserID);
				log.set('startUserid',request.params.userID);
				log.set('placeID', request.params.place);
				log.save();
				req[key] = 0;
				delete req[key];
				response.success('成功!');
			}).catch(function(error)
			{
				req[key]=0;
				delete req[key];
				return response.error('出错!');
			});
			});
			

			
		}
		else
		{
			req[key] = 0;
			delete req[key];
			return response.error('出错!');
		}
	});
});

//拍卖上架
AV.Cloud.define('upItem', function(request, response)
{
	//数值控制
	if(request.params.price <= 0 || request.params.itemCount <= 0)
	{
		return response.error('参数有误!');
	}
	//并发控制
	var req = reqCount();
	var key = "upItem," + request.params.userID;
	//console.log(reqCount().key);
	if(req[key])
	{
		if(req[key] > 0)
		{
			return response.error("请求过于频繁!");
		}
	}
	req[key] = 1;

	var query = new AV.Query('package');
	query.equalTo('userID', request.params.userID);
	query.equalTo('itemID', request.params.itemID);
	query.first().then(function(data)
	{
		if(!data)
		{
			return AV.Promise.error("该物品已经没有了!");
		}
		var nItemCount = data.get('itemCount');
		if(nItemCount < request.params.itemCount)
		{
			return AV.Promise.error('There was an error.');
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
		 if (process.env.LEANCLOUD_APP_ENV == 'stage') 
  		{
			console.log("写入拍卖数据");
		}
		
		var obj = new auctionItems;
		obj.set('ownerID', request.params.userID);
		obj.set('itemID', request.params.itemID);
		obj.set('itemCount', request.params.itemCount);
		obj.set('floorPrice', request.params.price);
		obj.set('itemName', request.params.name);
		obj.fetchWhenSave(true);
		return obj.save();
	}).then(function(obj)
	{
		req[key] = 0;
		delete req[key];
		var auctionID = obj.get('auctionID');
		console.log("auctionID:"+auctionID);
		return response.success(auctionID);
	}).catch(function(error)
	{
		//console.log(error);
		req[key] = 0;
		delete req[key];
		return response.error('上架失败!');
	});
});

//购买或下架
AV.Cloud.define('buyItem', function(request, response)
{
	var reqData = request.params;
	//并发控制
	var key = "auction," + reqData.auctionID;
	var req = reqCount();
	if(req[key])
	{
		if(req[key] > 0)
		{
			return response.error("该物品已经下架或者被买走了!");
		}
	}
	req[key] = 1;

	var log = new moneyLog();
	log.set('des', "交易中心购买");
	var query = new AV.Query('auctionItems');
	query.equalTo('auctionID', reqData.auctionID);
	query.first().then(function(data)//查询数据
	{
		if (!data)
		{
			return AV.Promise.error('There was an error.');
		}
		reqData.owner = data.get('ownerID');
		reqData.price = data.get('floorPrice');
		reqData.itemID = data.get('itemID');
		reqData.itemCount = data.get('itemCount');
		//console.log("删除拍卖物品!");
		log.set('acutionID', data.get('auctionID'));
		log.set('diamondIncrease', data.get('floorPrice'));
		log.set('userid', data.get('ownerID'));

		if(data.get('ownerID') == 6)
		{
			return AV.Promise.as('success');
		}
		return data.destroy();
	}).then(function(success)
	{
		var query1 = new AV.Query('chatUsers');
  		query1.equalTo('userID', reqData.buyer);

  		var query2 = new AV.Query('chatUsers');
  		query2.equalTo('userID', reqData.owner);
		var query = AV.Query.or(query1, query2);
		//console.log("orqueryerror");
		return query.find();
	}).then(function(results)
	{
		console.log('增加钻石和减少钻石!' + reqData.owner+","+reqData.buyer +"userCount:"+results.length);
		if(reqData.owner == reqData.buyer)
		{
			return AV.Promise.as('The good result.');
		}
		for (var i = 0; i < results.length; i++)
		{
			var obj = results[i];
			if(obj.get('userID') == reqData.owner)//收钱方
			{
				log.set('diamondBefore', obj.get('Diamond'));
				obj.increment('Diamond', reqData.price);
				//console.log('userID' + reqData.owner + "diamond:" + reqData.price);
			}
			else
			{
				if(obj.get('Diamond') < reqData.price)
				{
					//response.error('钻石数量不足!');
					return AV.Promise.error('钻石数量不足!');
				}
				obj.increment('Diamond', 0 - reqData.price);
				//console.log("userID" + obj.get('userID') + "diamond"+ obj.get('Diamond'));
			}
		}
		return AV.Object.saveAll(results);
	}).then(function(success)
	{
		log.set('otherid', reqData.buyer);
		query = new AV.Query('package');
		query.equalTo('userID', reqData.buyer);
		return query.find();
	}).then(function(results)
	{
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
		response.success('购买成功!');
		req[key]= 0;
		delete req[key];

		if(reqData.owner != reqData.buyer)
		{
			log.save();
		}
		
	}).catch(function(error)
	{
		response.error(error);
		req[key] = 0;
		delete req[key];
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
	if(req[key] && req[key] > 0)
	{
		//6个小时兑换一次
		//if(parseInt(new Date().getTime()/3600000) - req[key] < 6)
		{
			return response.error("兑换冷却中(每次兑换需要间隔6个小时)!");
		}
	}
	req[key] = 1;

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
			//console.log("error");
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
		req[key] = 0;
		delete req[key];
		return response.success(retData);

	}).catch(function(error)
	{
		log.save();
		//console.log("deal error");
		req[key] =0;
		delete req[key];
		return response.error('金币不足!');
	});
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
  },function(error)
  {
  		return response.error('未查询到用户信息!');
  });
  
});

AV.Cloud.define('checkAccount', function(request, response) 
{
	return response.error('暂未开放!');
	var uuid = request.params.uuid||'1234567';
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
	if((req[key] && req[key] > 0 )|| (req[key2] && req[key2] >0))
	{
		return response.error('error');
	}
	req[key] = 1;
	req[key2] = 1;
	return response.success('success');
	//改为存储到缓存,防止切换的时候出问题

});
AV.Cloud.define('clearPetRankFight',function(request, response)
{
	var req = reqCount();
	var key = "petRank:" + request.params.petID;
	var key2 = 'petRank:' + request.params.otherID;
	req[key] =0;
	delete req[key];
	req[key2] = 0;
	delete req[key];
	response.success('请求成功!');
});
var gold = [0,20,50,100,200,400,700,900,1200,1500,2000];
var charm = [0,5,15,40,80,180,300,450,600,700,800];
var plantName = ['','萝卜','胡萝卜','橙子','南瓜','小麦','雏菊','葡萄','西瓜','玉米','康乃馨'];
AV.Cloud.define('harvestPlant',function(request, response)
{
	var req = reqCount();
	var key = 'Plant:'+ request.params.buildingNo;
	if(req[key] && req[key] > 0)
	{
		return response.error('失败!');
	}
	req[key] = 1;
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
		//console.log('时间:',new Date().getTime()/1000, data.get('plantTime'));
		var second = new Date().getTime()/1000 + 3600*8 - data.get('plantTime');
		var plantTime = (plantID * 8 +4)*3600;
		if(second < plantTime)//未到收获时间
		{	
			return AV.Promise.error('shibai');
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
         console.log('魅力值+',charmCount);
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
		console.log('dailylikeAt:, now:', data.get('dailylikeAt'), new Date());
		if(data.get('dailylikeAt') && checkDaySame(data.get('dailylikeAt'), new Date()))//同一天,直接增加日魅力
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
		req[key] = 0;
		delete req[key];
		response.success(retData);
	}).catch(function(error)
	{
		req[key] = 0;
		delete req[key];
		response.error('收获失败!');
	})
});
function checkDaySame(date, now)
{
	return date.getFullYear() == now.getFullYear() && date.getMonth() == now.getMonth() && date.getDate() == now.getDate();
}

AV.Cloud.define('recoveryBuilding',function(request, response)
{
	var req = reqCount();
	var key = 'Recovery:'+ request.params.buildingNo;
	if(req[key] && req[key] > 0)
	{
		return response.error('失败!');
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
		req[key]  = 0;
		delete req[key];
		response.success({'diamond':diamond,'gold':gold})
	}).catch(function(error)
	{
		req[key] =0;
		delete req[key];
		response.error('error');
	});
});

//偷取植物
AV.Cloud.define('stealPlant',function(request, response)
{
	var req = reqCount();
	key = 'steal:'+request.params.buildingNo;
	if(req[key] && req[key] > 0)
	{
		return response.error('error');
	}
	req[key] = 1;
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
		req[key] = 1;
		delete req[key];
		response.success('完成!');
	}).catch(function(error)
	{	
		req[key] = 0;
		delete req[key];
		response.error('error');
	});
});

var timeMem= setInterval(function()
{
	if (process.env.LEANCLOUD_APP_ENV == 'stage') 
 	{
 		return ;
 	}
     var mem = process.memoryUsage();
     var format = function(bytes) 
     {
          return (bytes/1024/1024).toFixed(2)+'MB';
     };
     console.log('Process: heapTotal '+format(mem.heapTotal) + ' heapUsed ' + format(mem.heapUsed) + ' rss ' + format(mem.rss));
     console.log('----------------------------------------');

     var arr = Object.keys(reqCount());
     console.log('reqcount:',arr.length);


}, 30000);

//结婚装饰续费
AV.Cloud.define('renewDecoration', function(request, response)
{
	var weddingType = 0;
	return new AV.Query('chatUsers').equalTo('userID', request.params.userID).first().then(function(data)
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
	var userID = request.params.userID;
	var giftID = request.params.giftID;
	var toID = request.params.toID;
	var log = new GiftSendLog();
	var vipprice = [1.0,0.9,0.85,0.8,0.75,0.7,0.65,0.6,0.55,0.5];
	var step = 0;
	var gift = new AV.Object(JSON.parse(giftInfo[request.params.giftID]), {parse: true});
	var toUserName = '';
	var goldSend = 0;
	var diamondSend = 0;
	var loverIncrease = 1.0;
	return new AV.Query('chatUsers').equalTo('userID', userID).first().then(function(data)
		{
			//console.log(step++);
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
			data.increment('goldNum', -1* needGold * vipprice[data.get('VIPType')]);
			data.increment('Diamond', -1* needDiamond * vipprice[data.get('VIPType')]);
			if(data.get('dailyUseGoldAt') && checkDaySame(data.get('dailyUseGoldAt'), new Date()))
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
		//console.log(step++);
		data.fetchWhenSave(true);
		return data.save();
		}).then(function(data)
		{
			//console.log(step++);
			log.set('goldAfter', data.get('goldNum'));
			log.set('diamondAfter', data.get('Diamond'));
			return new AV.Query('chatUsers').equalTo('userID', toID).first();
		}).then(function(data)
		{
			//console.log(step++);
			log.set('toID', data.get('userID', toID));
			log.set('otherGoldQ', data.get('goldNum'));
			log.set('otherDiamondQ', data.get('Diamond'));
			log.set('curMeili', data.get('beLikedNum'));

			data.increment('beLikedNum', gift.get('Charm'));
			//日魅力增加
			if(gift.get('Charm') > 0)
			{
				if(data.get('dailylikeAt') && checkDaySame(data.get('dailylikeAt'), new Date()))
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
			//console.log(step++);
			toUserName = data.get('nickName');
			log.set('Meili', data.get('beLikedNum'));
			log.set('otherGoldH', data.get('goldNum'));
			log.set('otherDiamondH', data.get('Diamond'));
			return log.save();
		}).then(function(success)
		{
			//console.log(step++);
			console.log('写入赠送!');
			var query = new AV.Query('GiftSend');
			query.equalTo('userid', userID);
			query.equalTo('giftid', giftID);
			query.first().then(function(data)
			{
				if(data)
				{
					data.increment('count', 1);
					data.save();
				}
				else
				{
					var send = new GiftSend();
					send.set('userid', userID);
					send.set('giftid', giftID);
					send.set('giftName', gift.get('giftName'));
					send.set('count', 1);
					send.save();
				}
			});
			var giftrecv = new AV.Query('GiftRecv');
			giftrecv.equalTo('userid', toID);
			giftrecv.equalTo('giftid', giftID);
			giftrecv.first().then(function(data)
			{
				if(data)
				{
					data.increment('count', 1);
					data.save();
				}
				else
				{
					var send = new GiftRecv();
					send.set('userid', userID);
					send.set('giftid', giftID);
					send.set('giftName', gift.get('giftName'));
					send.set('count', 1);
					send.save();
				}
			});
			response.success({'userName':toUserName,'goldSend':goldSend,'diamondSend':diamondSend});

		}).catch(function(error)
		{
			console.log(error);
			log.save();
			response.error('发送失败!');
		});
});
function initGiftInfo()
{
	new AV.Query('GiftInfo').find().then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			giftInfo[data.get('GiftID')] = JSON.stringify(data);
			console.log('giftID:'+ data.get('GiftID'));
		}
	});
};

AV.Cloud.define('endMarriage', function(request, response)
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
		return response.error('离婚失败!');
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
				//console.log(key+ newArray);
			}
		}
	});
}, 1000);

AV.Cloud.define('useChestBatch', function(request, response)
{
	var req = reqCount();
	var reqKey = "useChest:" + request.params.userID;
	if(req[reqKey] && req[reqKey] > 0)
	{
		return response.error('访问太过频繁!');
	}
	req[reqKey] = 1;
	var random = seedrandom('added entropy.', { entropy: true });

	var itemID = request.params.itemID;
	var saveDatas = {};
	return new AV.Query('package').equalTo('userID', request.params.userID).find().then(function(results)
	{
		var data = null;
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
		var saveObjects = new Array();
		
		for(var i = 0; i < count; i++)
		{
			var number = random();
			var rand = Math.floor(number * 100);
			console.log(rand+","+number);
			var array = chestValue[itemID];
			console.log(array);
			var size = 0;
			for (var j = array.length - 1; j >= 0; j--) 
			{
				if(rand >= size && rand < size+ parseInt(array[j].random))
				{
					if( saveDatas[array[j].item] )
					{
						console.log(array[j].item);
						saveDatas[array[j].item] += 1;
					}
					else
					{
						console.log(array[j].item);
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
		console.log(saveDatas);
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
		saveDatas[request.params.itemID] = -1*count;
		if(data.get('itemCount') == count)
		{
			data.destroy();
		}
		else
			data.increment('itemCount', -1* count);
		saveObjects.push(data);
		return AV.Object.saveAll(saveObjects);
	}).then(function(success)
	{
		req[reqKey] = 0;
		delete req[reqKey];
		response.success(saveDatas);

	}).catch(function(error)
	{
		req[reqKey] = 0;
		delete req[reqKey];
		return response.error('道具不足!');
	});
});

module.exports = AV.Cloud;