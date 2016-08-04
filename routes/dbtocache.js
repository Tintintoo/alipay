'use strict';
var AV = require('leanengine');
var router = require('express').Router();
var redisClient = require('../redis').redisClient;

//从数据库转存至缓存

//系统参数
router.get('/chatSysVar', function(req, res, next) 
{
  //console.log('reqest');
  var query = new AV.Query('chatSysVar');
  query.limit(1000);
  query.ascending('sysID');
  query.find().then(function(results)
  {
    var data = {};
    //console.log(results.length);
    for (var i = results.length - 1; i >= 0; i--) 
    {
      var name = results[i].get('sysID');
      var value = results[i].get('syVar');
      data[name] = value;
    }
    //console.log(data);
    redisClient.setAsync('chatSysVar', JSON.stringify(data)).catch(console.error);
    //res.send('转存chatsysvar: ' + data);
  });
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});
//宠物系统参数
router.get('/petSysVar', function(req, res, next) 
{
  //console.log('reqest');
  var query = new AV.Query('petSysChar');
  query.limit(1000);
  query.ascending('sysID');
  query.find().then(function(results)
  {
    var data = {};
    //console.log(results.length);
    for (var i = results.length - 1; i >= 0; i--) 
    {
      var name = results[i].get('sysID');
      var value = results[i].get('strValue') || results[i].get('intValue');
      data[name] = value;
    }
    //console.log(data);
    redisClient.setAsync('petSysVar', JSON.stringify(data)).catch(console.error);
    //res.send('petSysVar: '+data);
  });
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

//礼物信息 -- 超时,没法利用
router.get('/giftInfo', function(req, res, next) 
{
  //console.log('reqest');
  var query = new AV.Query('GiftInfo');
  query.limit(1000);
  query.ascending('GiftID');
  //字段
  var fields = ['GiftID','Gold','Diamond','GoldMax','Charm','goldSend','DiamondSend','GoldMaxSend','Giftpriority','grounding',
      'bRandGold','bRandDiamond','bRandGoldMax','giftType','RandomMin','RandomMax','giftName'];
  query.find().then(function(results)
  {
    var data = {};
    //console.log(results.length);
    for (var i = results.length - 1; i >= 0; i--) 
    {
      var name = results[i].get('GiftID');
      var value = {};
      for (var j = fields.length - 1; j >= 0; j--) {
        value[fields[j]]=results[i].get(fields[j]);
      }
      data[name] = value;
    }
    //console.log(data);
    redisClient.setAsync('giftInfo', JSON.stringify(data)).catch(console.error);
    //res.send('giftInfo: '+JSON.stringify(data));
  });
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

module.exports = router;
