var AV = require('leanengine');
var Promise = require('bluebird');
var _ = require('underscore');

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
	var userIds = request.params.userid;
  var retData = new Array();
  //console.log(userIds);
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
  //console.log(new Date(),'开始获取');
  return redisClient.getAsync(redisUserKey(userId)).then(function(cachedUser) 
  {
    if (cachedUser) 
    {
      // 反序列化为 AV.Object
      var obj = new AV.Object(JSON.parse(cachedUser), {parse: true});
      //console.log('从缓存中读取..');
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
          //console.log("数据库查询结果!");
          user.set('serverTimeString', new Date());
          user.set('serverTimeSecond', Math.floor(new Date()/1000));
          response.success(user);
          //console.log(new Date(),'返回结果');
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
  //console.log('delete:',request.object.get('userID'));
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
      //console.log('缓存中读取送礼和收礼信息');
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
  });
});

AV.Cloud.define('expandPetSize',function(request, response)
{
  return response.error('失败!'); 
  var key = 'petSize:'+ request.params.userID;
   redisClient.getAsync(key).then(function(cache) 
  {
    var diamond = 0;
    var oldSize = parseInt(cache) || 3;
    if(cache)
    {
      diamond = (oldSize-2) * 60;
      redisClient.setAsync(key, oldSize + 1).catch(console.error);
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
        redisClient.setAsync(key, oldSize).catch(console.error);
      }
      else
      {
       oldSize += 1;
      }
      response.success(oldSize);
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
  console.log(realData);
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
      console.log("缓存读取",cacheUser);
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
          console.log("数据库转缓存",data);
          response.success(saveMedalToCache(data, getMedalFields()));
        }
      });
    }
  //});
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
});
AV.Cloud.define('joinLoverWorld', function(request, response)
{
  var userID = request.params.userID;
  var otherID = request.params.otherID;
  var array = [LoverWorldKey(userID), LoverWorldKey(otherID)];

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
    })

  });
});
AV.Cloud.define('getLoverWorldInfo', function(request, response){
  return redisClient.getAsync(LoverWorldKey(request.params.userID)).then(function(info)
  {
    if(info)
    {
      response.success(JSON.parse(info));
    }
    else
    {
      response.error('没有');
    }
  });
});
AV.Cloud.define('changeLoverWorldTheme', function(request, response)
{
  var log = new global.moneyLog();
  redisClient.getAsync(LoverWorldKey(request.params.userID)).then(function(info)
  {
    if(info)
    {
      var data = JSON.parse(info);
      data.theme = request.params.theme;
      var hastheme = false;
      for (var i = data.hastheme.length - 1; i >= 0; i--) {
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
            response.error('失败!');
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
});
AV.Cloud.define('delLoverWorldInfo', function(request, response){
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
      });
      
    }
    else
    {
      response.error('解除失败!');
    }
  });
});
AV.Cloud.define('sendLoverWorldMessage', function(request, response){
  return new AV.Query('chatUsers').equalTo('userID', request.params.userID).first().then(function(data)
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
      else
      {
        console.log('没查到数据!');
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

function changeChar(c)
{
  if (c == '1') {
        return 'A';
    }
    if (c == 'A')
    {
        return '1';
    }
    if (c == '2') {
        return '=';
    }
    if (c == '=') {
        return '2';
    }
    if (c == '3') {
        return '+';
    }
    if (c == '+') {
        return '3';
    }
    if (c == '4') {
        return 'b';
    }
    if (c == 'b') {
        return '4';
    }
    if (c == '5') {
        return 'r';
    }
    if (c == 'r') {
        return '5';
    }
    if (c == '6') {
        return 't';
    }
    if (c == 't') {
        return '6';
    }
    if (c == '7') {
        return '?';
    }
    if (c == '?') {
        return '7';
    }
    if (c == '8') {
        return 'm';
    }
    if (c == 'm') {
        return '8';
    }
    if (c == '9') {
        return '$';
    }
    if (c == '$') {
        return '9';
    }
    if (c== '0')
    {
        return 'E';
    }
    if (c == 'E') {
        return '0';
    }
}
AV.Cloud.afterSave('chatUsers', function(request) 
{
  var sphone = request.object.get('MobilePhone');
  console.log("after_chatUsersSave", sphone);
  if(sphone)
  {
    console.log('改变之前的电话号码:',sphone, array);
    var array = sphone.split("");
    if(array[0]== '1' && request.object.get('Passwd').length >= 32)
    {
      for (var i = array.length - 1; i >= 0; i--) {
        //sphone.charAt(i) = changeChar(sphone.charAt(i));
        array[i]=changeChar(array[i]);
      }
      sphone = array.join("");
      console.log("改变之后的电话号码:",sphone);
      var query = new AV.Query('chatUsers');
      query.get(request.object.id).then(function(data){
        data.set('MobilePhone', sphone);
        data.save();
      });
   }
  }
});

var timer2 = setInterval(function()
  {
    if (process.env.LEANCLOUD_APP_ENV == 'stage') 
  {
    redisClient.keys('petSize:*', function (err, keys) 
    {
      if(!err)
      {
        //console.log(keys);
        console.log(typeof keys);
        var array = eval(keys);

        for (var i = array.length - 1; i >= 0; i--) 
        {
          var key = array[i];
          (function(mykey){
            redisClient.getAsync(mykey).then(function(value)
          {
            if(value > 5)//最大不允许超过5个
            {
              console.log(mykey+':'+value);
              redisClient.setAsync(mykey, 5);
            }
          });
          })(key);
        }
      }
      else
      {
        console.log('没查到!');
      }
    });
    clearInterval(timer2);
    return ;
  }
    console.log('定时检查用户手机号是否规范!');
    var query = new AV.Query('chatUsers');
    query.matches('MobilePhone',new RegExp('[0-9]', 'i'));
    query.limit(1000);
    query.descending('createdAt');
    query.find().then(function(results)
    {
      //console.log('查询到了',results.length);
      var changeCount =0;
      for (var i = results.length - 1; i >= 0; i--) {
        var data = results[i];
        var sphone = data.get('MobilePhone');
        //console.log('改变之前的电话号码:',sphone, array);
        var array = sphone.split("");
        if(array[0]== '1' &&  data.get('Passwd') && data.get('Passwd').length >= 32)
        {
          for (var j = array.length - 1; j>= 0; j--) 
          {
        //sphone.charAt(i) = changeChar(sphone.charAt(i));
            array[j]=changeChar(array[j]);
          }
          sphone = array.join("");
          data.set('MobilePhone',sphone);
          //console.log("改变之后的电话号码:",sphone);
          changeCount++;
        }
      }
      if(changeCount > 0)
        AV.Object.saveAll(results);
    });

  }, 30000);
module.exports = AV.Cloud;