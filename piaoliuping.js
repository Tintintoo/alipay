var AV = require('leanengine');
var redis = require('redis');
var reqCount = require('./reqCount');

//创建赌场房间
AV.Cloud.define('createGameRoom', function(request, response) 
{
	//并发控制
	var key = "1," + request.params.userID;
	if(reqCount().key)
	{
		if(reqCount().key > 0)
		{
			return response.error("请求过于频繁!");
		}
	}
	reqCount().key = 1;

    var gambling = request.params.gambling;
	if(gambling <= 0)
	{
		response.error('参数错误!');
		delete reqCount().key;
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
    			delete reqCount().key;
    			return;
    		}
    		data.increment('goldNum', 0-gambling);
    	}
    	else
    	{
    		if(data.get('Diamond') < gambling)
    		{
    			response.error('钻石不足!');
    			delete reqCount().key;
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
    			delete reqCount().key;
    		},function(error)
    		{
    			//并发控制解除
    			delete reqCount().key;
    		});
    });
    
});

//挑战房间
AV.Cloud.define('joinPetGameQueue', function(request, response)
{
	//并发控制,根据room来控制,一个room只能发起一次请求
	var key = "gameRoom," + request.params.roomID;
	if(reqCount().key)
	{
		if(reqCount().key > 0)
		{
			return response.error("晚了一步!");
		}
	}
	reqCount().key = 1;
        
	var query = new AV.Query('gameRoom');
	query.equalTo('roomID', request.params.roomID);
	query.first().then(function(data)
	{
		return data.destroy();
	}).then(function(success)
	{
		response.success('挑战成功');
		delete reqCount().key;
	}).catch(function(error) 
	{
		response.error(error);
		delete reqCount().key;
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
	var key = "upItem," + request.params.userID;
	console.log(reqCount().key);
	if(reqCount().key)
	{
		if(reqCount().key > 0)
		{
			return response.error("请求过于频繁!");
		}
	}
	reqCount().key = 1;

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
		var auctionItems = AV.Object.extend('auctionItems');
		var obj = new auctionItems;
		obj.set('ownerID', request.params.userID);
		obj.set('itemID', request.params.itemID);
		obj.set('itemCount', request.params.itemCount);
		obj.set('floorPrice', request.params.price);
		obj.set('itemName', request.params.name);
		return obj.save();
	}).then(function(obj)
	{
		delete reqCount().key;
		return response.success(obj.get('auctionID'));
	}).catch(function(error)
	{
		console.log(error);
		delete reqCount().key;
		return response.success('上架失败!');
	});
});

//购买或下架
AV.Cloud.define('buyItem', function(request, response)
{
	var reqData = request.params;
	var key = "auction," + reqData.auctionID;
	if(reqCount().key)
	{
		if(reqCount().key > 0)
		{
			return response.error("该物品已经下架或者被买走了!");
		}
	}
	reqCount().key = 1;

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
		return data.destroy();
	}).then(function(success)
	{
		var query1 = new AV.Query('chatUsers');
  		query1.greaterThanOrEqualTo('userID', reqData.buyer);

  		var query2 = new AV.Query('chatUsers');
  		query2.equalTo('userID', reqData.owner);
		var query = AV.Query.or(query1, query2);
		return query.find();
	}).then(function(results)
	{
		if(reqData.owner == reqData.buyer)
		{
			return AV.Object.saveAll(results);
		}
		for (var i = results.lenth - 1; i >= 0; i--) 
		{
			var obj = results[i];
			if(obj.get('userID') == reqData.owner)//收钱方
			{
				obj.increment('Diamond', reqData.price);
			}
			else
			{
				if(obj.get('Diamond') < reqData.price)
				{
					response.error('钻石数量不足!');
					return false;
				}
				obj.increment('Diamond', 0 - reqData.price);
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
		delete reqCount().key;
	}).catch(function(error)
	{
		response.error(error);
		delete reqCount().key;
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
		if(request.params.silver <= 1000)
		{
			return response.error('银币不足!');
		}
		gold = request.params.silver/10;
		silver = 0-request.params.silver;
	}
	if(request.params.gold)
	{
		if(request.params.gold <= 100)
		{
			return response.error('金币不足!');
		}
		gold = 0-request.params.gold;
		silver = request.params.gold * 10;
	}
	//并发控制
	var key = "silverChange," + request.params.userID;
	console.log(reqCount().key);
	if(reqCount().key)
	{
		if(reqCount().key > 0)
		{
			return response.error("请求过于频繁!");
		}
	}
	reqCount().key = 1;
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
		delete reqCount().key;
		return response.success(retData);

	}).catch(function(error)
	{
		console.log("deal error");
		delete reqCount().key;
		return response.error('金币不足!');
	});
});

module.exports = AV.Cloud;