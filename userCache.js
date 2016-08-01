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
//查询user表
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
  redisClient.delAsync(redisUserKey(request.object.get('userID'))).catch(console.error)
});

module.exports = AV.Cloud;