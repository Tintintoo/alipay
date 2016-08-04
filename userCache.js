var AV = require('leanengine');
var Promise = require('bluebird');
var _ = require('underscore');

var router = require('express').Router();
var redisClient = require('./redis').redisClient;

function IsArray(value)
{
  if (value instanceof Array ||
    (!(value instanceof Object) &&
        (Object.prototype.toString.call((value)) == '[object Array]') ||
        typeof value.length == 'number' &&
        typeof value.splice != 'undefined' &&
        typeof value.propertyIsEnumerable != 'undefined' &&
        !value.propertyIsEnumerable('splice'))) {
    return 'array';
}

return 'object';
}
//查询user表 一组用户查询失败
AV.Cloud.define('getUserInfo',function(request, response)
{
	var userIds = request.params.userid;
  var retData = new Array();
  console.log(userIds);
  if(IsArray(userIds) == 'object')
  {
    fetchUserFromCache(userIds, response,'chatUsers');
  }
  else//一组用户超时
  {
    //response.success(fetchUsersFromCache(userIds));
  }
  
	/* 从缓存中读取一个 User, 如果没有找到则从云存储中查询 */
	
});

AV.Cloud.define('clearUserCache', function(request,response){
  redisClient.flushAll();
});

AV.Cloud.define('getMainBuilding',function(request,response)
{
  var userId = request.params.userID;
  redisClient.getAsync('building:'+userId).then(function(cachedUser) 
  {
    if (cachedUser) 
    {
      // 反序列化为 AV.Object
      var obj = new AV.Object(JSON.parse(cachedUser), {parse: true});
      console.log('从缓存中读取..');
      obj.set('serverTimeString', new Date());
      obj.set('serverTimeSecond', Math.floor(new Date()/1000));
      response.success(obj);
    } 
    else
    {
      var query = new AV.Query('building');
      query.equalTo('userID', userId);
      query.equalTo('buildingType', 1);
      query.first().then(function(building)
      {
        if(building)
        {
          redisClient.setAsync('building:'+userId, JSON.stringify(building)).catch(console.error);
        }
        response.success(building);
      });
    }
  });
});

//从缓存中读取一个用户
function fetchUserFromCache(userId, response)
{
  console.log(new Date(),'开始获取');
  return redisClient.getAsync(redisUserKey(userId)).then(function(cachedUser) 
  {
    if (cachedUser) 
    {
      // 反序列化为 AV.Object
      var obj = new AV.Object(JSON.parse(cachedUser), {parse: true});
      console.log('从缓存中读取..');
      obj.set('serverTimeString', new Date());
      obj.set('serverTimeSecond', Math.floor(new Date()/1000));
      //return obj;
      response.success(obj);
    } 
    else 
    {
      new AV.Query('chatUsers').equalTo('userID',userId).first().then(function(user) 
      {
        if(user)
        {
          console.log("数据库查询结果!");
          user.set('serverTimeString', new Date());
          user.set('serverTimeSecond', Math.floor(new Date()/1000));
          response.success(user);
          console.log(new Date(),'返回结果');
          redisClient.setAsync(redisUserKey(userId), JSON.stringify(user)).catch(console.error);
          return;
        }
        response.error('查询出错!');
      });
    }
  });
}
function redisUserKey(userId)
{
  return 'user:' +userId;
}
/* 在 User 被修改后删除缓存 */
AV.Cloud.afterUpdate('chatUsers', function(request) 
{
  console.log('delete:',request.object.get('userID'));
  redisClient.setAsync(redisUserKey(request.object.get('userID')), JSON.stringify(request.object)).catch(console.error);
  redisClient.expire(redisUserKey(request.object.get('userID')), 86400 * 3);
});

AV.Cloud.define('getChatSys', function(request, response)
{
  return redisClient.getAsync('chatSysVar').then(function(cachedUser) 
  {
     if (cachedUser) 
    {
      response.success(JSON.parse(cachedUser));
    }
    else
    {
      response.error('查询出错!');
    }
  });
});

AV.Cloud.define('getPetSys', function(request, response)
{
  return redisClient.getAsync('petSysVar').then(function(cachedUser) 
  {
     if (cachedUser) 
    {
      response.success(JSON.parse(cachedUser));
    }
    else
    {
      response.error('查询出错!');
    }
  });
});

AV.Cloud.define('getGiftInfo', function(request, response)
{
  return redisClient.getAsync('giftInfo').then(function(cachedUser) 
  {
     if (cachedUser) 
    {
      var data = JSON.parse(cachedUser);
      for (var key in data)
      {
        var realValue = JSON.parse(data[key]);
        data[key] = realValue;
      }
      response.success(data);
    }
    else
    {
      response.error('查询出错!');
    }
  });
});

AV.Cloud.define('getGiftHistory', function(request, response)
{

  var key = request.params.table+request.params.userID;
  return redisClient.getAsync(key).then(function(cachedUser) 
  {
     if (cachedUser) 
    {
      console.log('缓存中读取送礼和收礼信息');
      var data = JSON.parse(cachedUser);
      response.success(data);
    }
    else
    {
      //从数据库初始化
      new AV.Query(request.params.table).equalTo('userid',request.params.userID).find().then(function(results)
      {
        var data = {};
        for (var i = results.length - 1; i >= 0; i--)
        {
          data[results[i].get('giftid')] = {'giftName':results[i].get('giftName'), 'count':results[i].get('count')};
        }
        response.success(data);
        redisClient.setAsync(key, JSON.stringify(data)).catch(console.error);
      });
    }
  });
});
AV.Cloud.afterUpdate('GiftRecv', function(request) 
{
  //console.log('delete:',request.object.get('userid'));
  var object = request.object;
  var key = 'GiftRecv'+ object.get('userid');
  redisClient.getAsync(key).then(function(cachedUser) 
  {
    if(cachedUser)
    {
      console.log('saveGiftRecv');
      var data = JSON.parse(cachedUser);
      data[object.get('giftid')] = {'giftName':object.get('giftName'), 'count':object.get('count')};
      redisClient.setAsync(key, JSON.stringify(data)).catch(console.error);
      return;
    }
  });
});
AV.Cloud.afterUpdate('GiftSend', function(request) 
{
  var object = request.object;
  var key = 'saveGiftSend'+object.get('userid');
  redisClient.getAsync(key).then(function(cachedUser) 
  {
    if(cachedUser)
    {
      console.log('saveGiftSend');
      var data = JSON.parse(cachedUser);
      data[object.get('giftid')] = {'giftName':object.get('giftName'), 'count':object.get('count')};
      redisClient.setAsync(key, JSON.stringify(data)).catch(console.error);
      return;
    }
  });
});

AV.Cloud.define('getUserPetSize', function(request, response)
{
  var key = 'petSize:'+ request.params.userID;
  redisClient.getAsync(key).then(function(cache) 
  {
    if(cache)
    {
      response.success(cache);
    }
    else
    {
      var data = 3;
      response.success(data);
      redisClient.setAsync(key, 3).catch(console.error);
    }
  });
});

AV.Cloud.define('expandPetSize',function(request, response)
{
  var key = 'petSize:'+ request.params.userID;
   redisClient.getAsync(key).then(function(cache) 
  {
    var diamond = 0;
    var oldSize = parseInt(cache) || 3;
    if(cache)
    {
      diamond = (oldSize-2) * 60;
      redisClient.setAsync(key, oldSize+1).catch(console.error);
    }
    else
    {
      diamond = 60;
      redisClient.setAsync(key, 4).catch(console.error);
    }
    new AV.Query('chatUsers').equalTo('userID', request.params.userID).first(function(data)
    {
        if(diamond <= 0)
        {
          diamond = 60;
        }
        data.increment('Diamond', -1*diamond);
        data.fetchWhenSave(true);
        return data.save();
    }).then(function(data)
    {
      if(data.get('Diamond') < 0)
      {
        redisClient.setAsync(key, oldSize).catch(consol.error);
      }
      else
      {
       oldSize += 1;
      }
      response.success(oldSize);
    });
  });
});

module.exports = AV.Cloud;