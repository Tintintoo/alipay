var AV = require('leanengine');
var redis = require('redis');
var reqCount = require('./reqCount');

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

    var gambling = request.params.gambling;
	if(gambling <= 0)
	{
		response.error('参数错误!');
		req[key] = 0;
		delete req[key];
		return;
	}
	var place = request.params.place;
	var query = new AV.Query('chatUsers');
    query.equalTo('userID', request.params.userID);
    query.first().then(function (data)
    {
    	if(place < 5)
    	{
    		if(data.get('goldNum') < gambling)
    		{
    			response.error('金币不足!');
    			//并发控制解除
    			req[key] = 0;
				delete req[key];
    			return;
    		}
    		data.increment('goldNum', 0-gambling);
    	}
    	else
    	{
    		if(data.get('Diamond') < gambling)
    		{
    			response.error('钻石不足!');
    			//并发控制解除
    			req[key] = 0;
				delete req[key];
    			return;
    		}
    		data.increment('Diamond', 0-gambling);
    	}
    	data.save().then(function(data)
    		{
    			var gameRoom = AV.Object.extend('gameRoom');
    			var obj = new gameRoom();
    			obj.set('userID', request.params.userID);
    			obj.set('gambling', request.params.gambling);
    			obj.set('placeID', request.params.place);
    			obj.set('gameID', request.params.game);
    			obj.set('roomTitle', request.params.title);
    			obj.save();
    			response.success('创建成功!');
    			console.log('创建房间',request.params);
    			//并发控制解除
    			req[key] = 0;
				delete req[key];
    		},function(error)
    		{
    			//并发控制解除
    			req[key] = 0;
				delete req[key];
    		});
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
        
	var query = new AV.Query('gameRoom');
	query.equalTo('roomID', request.params.roomID);
	query.first().then(function(data)
	{
		if( !data)
		{
			return AV.Promise.error('There was an error.');
		}
		return data.destroy();
	}).then(function(success)
	{
		response.success('挑战成功');
		req[key] = 0;
		delete req[key];
	}).catch(function(error) 
	{
		response.error(error);
		req[key] = 0;
		delete req[key];
  	});
});

//拍卖上架
AV.Cloud.define('upItem', function(request, response)
{
	//数值控制
	if(request.params.price <= 0 || request.params.itemCount <= 0)
	{
		response.error('参数有误!');
		return ;
	}
	//并发控制
	var req = reqCount();
	var key = "upItem," + request.params.userID;
	console.log(reqCount().key);
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
		var auctionItems = AV.Object.extend('auctionItems');
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
		console.log(error);
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
		console.log("删除拍卖物品!");
		return data.destroy();
	}).then(function(success)
	{
		var query1 = new AV.Query('chatUsers');
  		query1.equalTo('userID', reqData.buyer);

  		var query2 = new AV.Query('chatUsers');
  		query2.equalTo('userID', reqData.owner);
		var query = AV.Query.or(query1, query2);
		console.log("orqueryerror");
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
				obj.increment('Diamond', reqData.price);
				console.log('userID' + reqData.owner + "diamond:" + reqData.price);
			}
			else
			{
				if(obj.get('Diamond') < reqData.price)
				{
					response.error('钻石数量不足!');
					return AV.Promise.error('钻石数量不足!');
				}
				obj.increment('Diamond', 0 - reqData.price);
				console.log("userID" + obj.get('userID') + "diamond"+ obj.get('Diamond'));
			}
		}
		return AV.Object.saveAll(results);
	}).then(function(success)
	{
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
		var package = AV.Object.extend('package');
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
	var silver =0;
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
	console.log(reqCount().key);
	if(req[key])
	{
		if(req[key] > 0)
		{
			return response.error("请求过于频繁!");
		}
	}
	req[key] = 1;
	var query = new AV.Query('chatUsers');
	query.equalTo('userID', request.params.userID);
	query.first().then(function(data)
	{
		if(!data)
		{
			return AV.Promise.error('There was an error.');
		}
		console.log('gold:' + gold + "silver:" +silver);
		if(data.get('goldNum') < -1*gold  || data.get('silverCoin') < -1 * silver)
		{
			//console.log("error");
			return AV.Promise.error('There was an error.');
		}
		data.increment('goldNum', gold);
		data.increment('silverCoin', silver);
		return data.save();
	}).then(function(data)
	{
		//console.log("success");
		var retData = {goldNum:data.get('goldNum'), silverCoin:data.get("silverCoin")};
		req[key] = 0;
		delete req[key];
		return response.success(retData);

	}).catch(function(error)
	{
		console.log("deal error");
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
  	var sealInfo = AV.Object.extend('sealInfo');
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
	if((req[key] && req[key] > 0) ||(req[key2] && req[key2] > 0))
	{
		return response.error("请求过于频繁!");
		
	}

	req[key] = 1;
	req[key2] = 1;
	return response.success('请求成功!');
});
AV.Cloud.define('clearPetRankFight',function(request, response)
{
	var req = reqCount();
	var key = "petRank:" + request.params.petID;
	var key2 = 'petRank:' + request.params.otherID;
	req[key] = 0;
	delete req[key];
	req[key2] = 0;
	delete req[key2];
	response.success('请求成功!');
});
module.exports = AV.Cloud;