var AV = require('leanengine');
var Promise = require('bluebird');
var _ = require('underscore');
var common = require('./common');

var router = require('express').Router();
var redisClient = require('./redis').redisClient;
var piaoliupng = require('./piaoliuping');

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
	var userID = request.params.userID;
  console.log(request.params);
  var retData = new Array();
  //if(IsArray(userIds) == 'object')
  //{
    fetchUserFromCache(userID, response,'chatUsers');
 // }
 // else//一组用户超时
 // {
    //response.success(fetchUsersFromCache(userIds));
//  }
  
	/* 从缓存中读取一个 User, 如果没有找到则从云存储中查询 */
	
});

AV.Cloud.define('clearUserCache', function(request,response){
  redisClient.flushAll();
});

AV.Cloud.define('getMainBuilding',function(request,response)
{
  var userId = request.params.userID;
  //redisClient.getAsync('building:'+userId).then(function(cachedUser) 
  //{
  //  if (cachedUser) 
  //  {
      // 反序列化为 AV.Object
  //    var obj = new AV.Object(JSON.parse(cachedUser), {parse: true});
      //console.log('从缓存中读取..');
  //    obj.set('serverTimeString', new Date());
  //    obj.set('serverTimeSecond', Math.floor(new Date()/1000));
  //    response.success(obj);
 //   } 
 //   else
    {
      var query = new AV.Query('building');
      query.equalTo('userID', userId);
      query.equalTo('buildingType', 1);
      query.first().then(function(building)
      {
        //if(building)
        //{
        //  redisClient.setAsync('building:'+userId, JSON.stringify(building)).catch(console.error);
        //  redisClient.expire('building:'+userId, 86400);
        //}
        response.success(building);
      });
    }
  //});
});

//从缓存中读取一个用户
function fetchUserFromCache(userId, response)
{
  return redisClient.getAsync(redisUserKey(userId)).then(function(cachedUser) 
  {
    if (cachedUser) 
    {
      // 反序列化为 AV.Object
      var obj = new AV.Object(JSON.parse(cachedUser), {parse: true});
      obj.set('serverTimeString', new Date());
      obj.set('serverTimeSecond', Math.floor(new Date()/1000));
      
      var vipDate = common.stringToDate(obj.get('VIPDay'));
      if(obj.get('VIPType') > 0 && common.checkDayGreater(new Date(), vipDate))
      {
        obj.set('VIPType', 0);
        new AV.Query('chatUsers').equalTo('userID', userId).first().then(function(user)
        {
          user.set('VIPType', 0);
          user.save();
        });
      }
      response.success(obj);
    } 
    else 
    {
      new AV.Query('chatUsers').equalTo('userID',userId).first().then(function(user) 
      {
        if(user)
        {
          user.set('serverTimeString', new Date());
          user.set('serverTimeSecond', Math.floor(new Date()/1000));
          var vipDate = common.stringToDate(user.get('VIPDay'));
          if(user.get('VIPType') > 0 && common.checkDayGreater(new Date(), vipDate))
          {
            user.set('VIPType', 0);
            user.save();
          }
          response.success(user);
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
  }).catch(function(error)
  {
    response.error(error);
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
  }).catch(function(error)
  {
    return response.error('查询失败!');
  });
});

AV.Cloud.define('getGiftHistory', function(request, response)
{

  var key = request.params.table+request.params.userID;
  //return redisClient.getAsync(key).then(function(cachedUser) 
  //{
  //   if (cachedUser) 
  //  {
  //    var data = JSON.parse(cachedUser);
  //    response.success(data);
  //  }
  //  else
  //  {
      //从数据库初始化
      new AV.Query(request.params.table).equalTo('userid',request.params.userID).find().then(function(results)
      {
        var data = {};
        for (var i = results.length - 1; i >= 0; i--)
        {
          data[results[i].get('giftid')] = {'giftName':results[i].get('giftName'), 'count':results[i].get('count')};
        }
        //console.log(data);
        response.success(data);
        redisClient.setAsync(key, JSON.stringify(data)).catch(console.error);
      }).catch(function(error)
      {
        response.error(error);
      });
   // }
  //});
});
AV.Cloud.afterUpdate('GiftRecv', function(request) 
{
  //console.log('delete:',request.object.get('userid'));
  var object = request.object;
  //var key = 'GiftRecv'+ object.get('userid');
  saveGiftCache('GiftRecv', object);
});
function saveGiftCache(table, object)
{
  var key = table + object.get('userid');
  redisClient.getAsync(key).then(function(cachedUser) 
  {
    if(cachedUser)
    {
      var data = JSON.parse(cachedUser);
      data[object.get('giftid')] = {'giftName':object.get('giftName'), 'count':object.get('count')};
      redisClient.setAsync(key, JSON.stringify(data)).catch(console.error);
      return;
    }
  });
}
AV.Cloud.afterSave('GiftRecv', function(request) 
{
  var object = request.object;
  //var key = 'GiftRecv'+ object.get('userid');
  saveGiftCache('GiftRecv', object);
});
AV.Cloud.afterSave('GiftSend', function(request)
{
   var object = request.object;
  saveGiftCache('GiftSend', object);
}); 
AV.Cloud.afterUpdate('GiftSend', function(request) 
{
  var object = request.object;
  saveGiftCache('GiftSend', object);
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
  }).catch(function(error)
  {
    response.error('失败!');
  });
});

AV.Cloud.define('expandPetSize',function(request, response)
{
  //return response.error('失败!'); 
  var key = 'petSize:'+ request.params.userID;
  redisClient.getAsync(key).then(function(cache) 
  {
    var diamond = 0;
    var oldSize = parseInt(cache) || 3;
    if(cache)
    {
      diamond = (oldSize-2) * 60;
      //redisClient.setAsync(key, oldSize + 1).catch(console.error);
    }
    else
    {
      diamond = 60;
      //redisClient.setAsync(key, 4).catch(console.error);
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
      return new AV.Query('chatUsers').equalTo('userID', request.params.userID).first();
    }).then(function(data)
    {
        if(diamond <= 0)
        {
          diamond = 60;
        }
        if(data.get('Diamond') < diamond)
        {
          return AV.Promise.error('开通失败!');
        }
        data.increment('Diamond', -1*diamond);
        data.fetchWhenSave(true);
        return data.save();
    }).then(function(data)
    {
      oldSize += 1;
      redisClient.setAsync(key, oldSize).catch(console.error);
      response.success(oldSize);
    }).catch(function(error)
    {
      response.error(error);
    });
  });
});
function saveMedal(count, fields, orderField, table)
{
  var medal = AV.Object.extend('medal');
  new AV.Query(table || 'chatUsers').descending(orderField).find().then(function(results)
  {
    var saveData = new Array();
    for (var i = 0; i < count; i++) 
    {
      var field = '';
      if(i <3)
      {
        field = fields[i];
      }
      else if(i < 10)
      { 
        field = fields[3];
      }
      else
        field = fields[4];
      var data = {'userID':results[i].get('userID'), 'field':field};
      saveData.push(data);
    }
    return AV.Promise.as(saveData);
  }).then(function(saveData)
  {
    var userIds = new Array();
    for (var i = saveData.length - 1; i >= 0; i--) {
      userIds.push(saveData[i].userID);
    }
    return new AV.Query('medal').containedIn('userID',userIds).find().then(function(results)
    {
      for (var i = results.length - 1; i >= 0; i--) 
      {
        for (var j=saveData.length - 1; j >= 0; j--)
         {
          if(saveData[j].userID == results[i].get('userID'))
          {
            results[i].increment(saveData[j].field,1);
            delete saveData[j].field;
            results[i].save();
          }
      
        }
      }
      for (var i = saveData.length - 1; i >= 0; i--) 
      {
        if (saveData[i].field)
        {
          var obj = new medal();
          obj.set('userID', saveData[i].userID);
          obj.set(saveData[i].field, 1);
          obj.save();
        }
      }
    });
  });
}
function saveGoldRank()
{
  console.log('saveGoldRank');
  return saveMedal(50, ['gold_1','gold_2','gold_3','gold_4','gold_5'], 'goldNum');
}

function saveGoldUseRank()
{
  console.log('saveGoldUseRank');
  return saveMedal(3, ['use_1','use_2','use_3'], 'dailyUseGold');
}
function saveCharmRank()
{
  console.log('saveCharmRank');
  return saveMedal(50, ['charm_1','charm_2','charm_3','charm_4','charm_5'], 'dailylike');
}
function saveGoodRank()
{
  console.log('saveGoodRank');
  return saveMedal(50, ['good_1','good_2','good_3','good_4','good_5'], 'dailygood');
}
function saveHouseRank()
{
  console.log('saveHouseRank');
  return saveMedal(50, ['house_1','house_2','house_3','house_4', 'house_5'], 'exp', 'building');
}
function getMedalFields()
{
  return ['gold_1','gold_2','gold_3','gold_4','gold_5','use_1','use_2','use_3','charm_1','charm_2','charm_3','charm_4','charm_5',
  'good_1','good_2','good_3','good_4','good_5','house_1','house_2','house_3','house_4', 'house_5'];
}
function getMedalFielsDescribe()
{
  return['财富榜第一名可以获得此勋章', '财富榜第二名可以获得此勋章','财富榜第三名可以获得此勋章','财富榜4~10名可以获得此勋章','财富榜11-50名可以获得此勋章',
  '土豪日榜第一名可以获得此勋章','土豪榜第二名可以获得此勋章','土豪榜第三名可以获得此勋章','魅力榜第一名可以获得此勋章','魅力榜第二名可以获得此勋章',
  '魅力榜第三名可以获得此勋章','魅力榜4~10名可以获得此勋章','魅力榜11-50名可以获得此勋章','好评榜第一名可以获得此勋章','好评榜第二名可以获得此勋章',
  '好评榜第三名可以获得此勋章','好评榜4~10名可以获得此勋章','好评榜11-50名可以获得此勋章','房屋级别排名第一可以获得此勋章','房屋级别排名第二可以获得此勋章'
  ,'房屋级别排名第三可以获得此勋章','房屋级别排名4~10可以获得此勋章','房屋级别排名11-50可以获得此勋章'];
}
function saveMedalToCache(data, medalFields)
{
  var realData ={};
  for (var i = medalFields.length - 1; i >= 0; i--)
  {
    var value = data.get(medalFields[i]);
    if(value && value != 0)
      realData[medalFields[i]] = data.get(medalFields[i]);
  }
  redisClient.setAsync('medal:'+ data.get('userID'), JSON.stringify(realData)).catch(console.error);
  return realData;
}
AV.Cloud.define('getMedalFields',function(request, response)
{
  response.success(getMedalFields().concat(getMedalFielsDescribe()));
});
AV.Cloud.define('getMedalInfo',function(request, response)
{
  //var medalFields = getMedalFields();//.then(function(medalFields)
  //{
    return redisClient.getAsync('medal:'+request.params.userID).then(function(cacheUser)
  {
    if(cacheUser)
    {
      return response.success(JSON.parse(cacheUser));
    }
    else
    {
      new AV.Query('medal').equalTo('userID', request.params.userID).first().then(function(data)
      {
        if(!data)
        {
          return response.error('没有勋章!');
        }
        else
        {
          response.success(saveMedalToCache(data, getMedalFields()));
        }
      })//.catch(response.error);
    }
  //});
  }).catch(function(error)
  {
    response.error(error);
  });
  
});
AV.Cloud.afterUpdate('medal', function(request) 
{
  saveMedalToCache(request.object, getMedalFields());
});

AV.Cloud.define('saveMedalInfo',function(request, response)
{
  saveGoldRank();
  //20秒之后再执行
  setTimeout(saveGoldUseRank(), 20000);
  setTimeout(saveCharmRank(), 40000);
  setTimeout(saveGoodRank(), 60000);
  setTimeout(saveHouseRank(), 80000);
  response.success('完成!');
});
AV.Cloud.define('joinLoverWorld', function(request, response)
{
  var userID = request.params.userID;
  var otherID = request.params.otherID;
  var array = [LoverWorldKey(userID), LoverWorldKey(otherID)];
  return redisClient.getAsync('token:' + userID).then(function(cache)
  {
    if(!cache || cache != request.params.token)
    {
      //评价人的令牌与userid不一致
      if (global.isReview == 0)
      {
        return response.error('访问失败!');
      }
    }
    redisClient.getAsync(array[0]).then(function(info)
    {
      var data = {'other':0, 'intimacy':0, 'theme':0, 'hastheme':[0]};
      if (info) 
      {
        data = JSON.parse(info);
        if(data.other > 0)
        {
          return response.error('error');
        }
      }
      data.other  = otherID;
      redisClient.getAsync(array[1]).then(function(info)
      {
        var data2 = {'other': 0, 'intimacy':0, 'theme':0, 'hastheme':[0]};
        if(info)
        {
          data2 = JSON.parse(info);
          if(data2.other >0)
          {
            return response.error('error');
          }
        }
        data2.other = userID;
        redisClient.setAsync(array[0], JSON.stringify(data));
        redisClient.setAsync(array[1], JSON.stringify(data2));
        return response.success('success');
      });
    });
  }).catch(response.error);
});
AV.Cloud.define('getLoverWorldInfo', function(request, response)
{
  return redisClient.getAsync(LoverWorldKey(request.params.userID)).then(function(info)
  {
    if(info)
    {
      return response.success(JSON.parse(info));
    }
    else
    {
      return response.error('没有');
    }
  }).catch(response.error);
});

AV.Cloud.define('changeLoverWorldTheme', function(request, response)
{
  var log = new global.moneyLog();
  var userID = request.params.userID;
  return redisClient.getAsync('token:' + userID).then(function(cache)
  {
    if(!cache || cache != request.params.token)
    {
      //评价人的令牌与userid不一致
      if (global.isReview == 0)
      {
        return response.error('访问失败!');
      }
    }
    redisClient.getAsync(LoverWorldKey(request.params.userID)).then(function(info)
    {
      if(info)
      {
        var data = JSON.parse(info);
        data.theme = request.params.theme;
        var hastheme = false;
        for (var i = data.hastheme.length - 1; i >= 0; i--)
         {
          if (data.hastheme[i] == request.params.theme)
          {
            hastheme = true;
          }
        }
        if(hastheme == false)
        {
            new AV.Query('chatUsers').equalTo('userID', request.params.userID).first().then(function(obj)
            {
              if(!obj)
              {
                return AV.Promise.error('ere');
              }
              log.set('userid', obj.get('userID'));
              log.set('des', '购买二人世界主题');
              log.set('diamondBefore', obj.get('Diamond'));
              var diamond = 0;
              if(request.params.theme == 1)
              {
                diamond = 200;
              }
              else if(request.params.theme == 2)
              {
               diamond = 500;
              }
              else if(request.params.theme == 3)
              {
                diamond = 1000;
              }
              if(obj.get('Diamond') < diamond)
              {
                return AV.Promise.error('error');
              }

              obj.increment('Diamond',-1 * diamond);
              obj.fetchWhenSave(true);
              return obj.save();
            }).then(function(obj)
            {
              log.set('diamondAfter', obj.get('Diamond'));
              log.save();
              response.success("更换成功!");

              data.hastheme.push(request.params.theme);
              redisClient.setAsync(LoverWorldKey(request.params.userID), JSON.stringify(data));
              redisClient.getAsync(LoverWorldKey(data.other)).then(function(info){
                if(info)
                {
                  var other = JSON.parse(info);
                  other.theme = request.params.theme;
                  //对方只更换背景,而非购买背景,只有自己拥有背景,对方可以享用背景
                  redisClient.setAsync(LoverWorldKey(data.other), JSON.stringify(other));
                }
              });
            }).catch(function(error)
            {
              log.save();
              //response.error('失败!');
            });
        }
        else
        {
          redisClient.setAsync(LoverWorldKey(request.params.userID), JSON.stringify(data));
          redisClient.getAsync(LoverWorldKey(data.other)).then(function(info){
            if(info)
            {
             var other = JSON.parse(info);
             other.theme = request.params.theme;
                  //对方只更换背景,而非购买背景,只有自己拥有背景,对方可以享用背景
              redisClient.setAsync(LoverWorldKey(data.other), JSON.stringify(other));
           }
          });
          response.success('success');
        }
        
      }
    });
  }).catch(response.error);
});
AV.Cloud.define('delLoverWorldInfo', function(request, response)
{
  return redisClient.getAsync('token:' + request.params.userID).then(function(cache)
  { 
    if(!cache || cache != request.params.token)
    {
      if(global.isReview == 0)
      {
        return response.error('访问失败!');
      }
    }
    redisClient.getAsync(LoverWorldKey(request.params.userID)).then(function(info)
    {
      if(info)
      {
        var data = JSON.parse(info);
        var key2 = LoverWorldKey(data.other);
        data.theme = 0;
        data.other = 0;
        data.intimacy = 0;
        redisClient.setAsync(LoverWorldKey(request.params.userID), JSON.stringify(data));
        redisClient.getAsync(key2).then(function(info)
        {
          if(info)
          {
            var data = JSON.parse(info);
            data.theme = 0;
            data.other = 0;
            data.intimacy = 0;
            redisClient.setAsync(key2, JSON.stringify(data));
            response.success('解除成功!');
          }
          else
          {
            response.error('解除失败!');
          }
        });//.catch(response.error);
      }
      else
      {
        return response.error('解除失败!');
      }
    });
  }).catch(response.error);
});

AV.Cloud.define('sendLoverWorldMessage', function(request, response)
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
    return new AV.Query('chatUsers').equalTo('userID', request.params.userID).first();
  }).then(function(data)
  {
    if(data.get('goldNum') < 100)
    {
      return AV.Promise.error('金币不足!');
    }
    data.increment('goldNum', -100);
    return data.save();
  }).then(function(succeed)
  {
    var date = new Date();
    response.success({'year':date.getFullYear(), 'month':date.getMonth()+1,'day':date.getDate(),'hour':date.getHours(),
        'minute':date.getMinutes(),'second':date.getSeconds(),'timestamp':parseInt(date.getTime()/1000+28800)});
    redisClient.getAsync(LoverWorldKey(request.params.userID)).then(function(info)
    {
      if(info)
      {
        var data = JSON.parse(info);
        data.intimacy +=1;
        //console.log(data);
        redisClient.setAsync(LoverWorldKey(request.params.userID), JSON.stringify(data));
        var key2 = LoverWorldKey(JSON.parse(info).other);
        redisClient.getAsync(key2).then(function(info)
        {
          var data = JSON.parse(info);
          data.intimacy += 1;
          redisClient.setAsync(key2, JSON.stringify(data));
        });
      }
    });
  }).catch(function(error)
  {
    return response.error('失败!');
  })
});

AV.Cloud.define("getIntimacyRank", function(request, response)
{
  redisClient.keys(LoverWorldKey('*'), function (err, keys) 
    {
      if(!err)
      {
        var array = eval(keys);
        var needSort = new Array();
        for (var i = array.length - 1; i >= 0; i--) 
        {
          var key = array[i];
          (function(mykey){
            redisClient.getAsync(mykey).then(function(value)
          {
            if(JSON.parse(value).intimacy > 0)
            {
              var data = JSON.parse(value);
              delete data.theme;
              delete data.hastheme;
              data['userID'] = mykey.substring(11);
              needSort.push(data);
            }
            if(mykey == array[0])
            {
              needSort.sort(function(a,b){return b.intimacy - a.intimacy});
              response.success(needSort.slice(0, 20));
            }
          });
          })(key);
        }
      }
    });
});

function LoverWorldKey(userID)
{
  return 'loverWorld:'+userID;
}
AV.Cloud.define('getBadUserCache', function(req, res)
{
  redisClient.keys(redisUserKey('*'), function (err, keys) 
    {
      var array = eval(keys);
      for (var i = array.length - 1; i >= 0; i--) 
      {
        (function(myKey){
          redisClient.getAsync(myKey).then(function(cacheUser)
        {
          console.log(myKey);
          var user = JSON.parse(cacheUser);
        });
        })(array[i]);
      }
    });
});
module.exports = AV.Cloud;