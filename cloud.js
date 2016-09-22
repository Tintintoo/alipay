var AV = require('leanengine');
var WXPay = require('./lib/wxpay');
var util = require('./lib/util');
//var reqCount = reqire('./reqCount');
var IAPInfo = AV.Object.extend('IAPInfo');
var piaoliuping = require('./piaoliuping');
var common = require('./common');
/**
 * 一个简单的云代码方法
 */
//获取服务器时间
var WeChatOrder = AV.Object.extend('wechatOrder');

AV.Cloud.define('getServerTime', function(request, response) 
{
  response.success(new Date());
});

//获取服务器时间 秒数
AV.Cloud.define('getTimeSecond', function(request, response) 
{
  var date = new Date().getTime()/1000;
  response.success(date);
});
AV.Cloud.define('getTimeSecond_BJ', function(request, response) 
{
  var date = new Date().getTime()/1000;
  //转到北京时间
  date += 3600 * 8;
  response.success(date);
});
AV.Cloud.define('getTimeYMD_BJ',function(request,response)
{
  var date = new Date();
  response.success({'year':date.getFullYear(), 'month':date.getMonth()+1,'day':date.getDate(),'hour':date.getHours(),
    'minute':date.getMinutes(),'second':date.getSeconds(),'timestamp':parseInt(date.getTime()/1000+28800)});
});

//获取签名
AV.Cloud.define('getWXPaySign', function(request, response){
  var WXPay = require('./lib/wxpay');
  var wxpay = WXPay({
    appid: 'wxf3633e02a28d60f0',
    mch_id: '1364004502',
    partner_key: 'jiudianZxcvbnmDSAD1weqwkj89991oo' //微信商户平台API密钥
  });
  console.log(request.params);
  var sign = wxpay.sign(request.params);
  console.log(sign);
  response.success(sign);
})

//统一下单
AV.Cloud.define('WxCreateUnifiedOrder', function(request, response)
{
  //老的下单方式废弃
  return response.error('Error');
  var wxpay = WXPay({
    appid: 'wxf3633e02a28d60f0',
    mch_id: '1364004502',
    partner_key: 'jiudianZxcvbnmDSAD1weqwkj89991oo' //微信商户平台API密钥
  });
  //客户端IP
  var clientIP = request.meta.remoteAddress;
  //request.params.spbill_create_ip = clientIP;
  //request.params.notify_url = "http://asplp.leanapps.cn/pay";
  var goldNum = request.params.goldNum;
  var diamond = request.params.Diamond;
  var userid = request.params.userid;
  //计算实际支付金额
  var fee = goldNum + diamond*100;
  if(fee <= 0)
  {
    response.error('支付参数错误!');
    return;
  }
  else if(fee < 60000)
  {
    fee *= 0.8;
  }
  else
  {
    fee *= 0.5;
  }
  var notifyurl = 'http://asplp.leanapp.cn/pay';
  if (process.env.LEANCLOUD_APP_ENV == 'stage') 
  {
    notifyurl ='http://stg-asplp.leanapp.cn/pay';
    //fee = 1;
  }
  //console.log(notifyurl);
  var date = new Date();

  var orderData = 
  {
    appid:'wxf3633e02a28d60f0',
    body:'有朋充值',
    mch_id:"1364004502",
    total_fee:fee,
    notify_url:notifyurl,
    out_trade_no: Math.floor((date.getTime()+Math.random())*1000).toString(),
    nonce_str:util.generateNonceString(),
    attach:userid.toString(), 
    spbill_create_ip : clientIP,
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
      order.set('goldNum', goldNum);
      order.set('Diamond', diamond);
      order.set('needFee', fee/100);
      order.save();
    }
    else
    {
      response.error(result.return_msg);
    }
    //console.log("统一下单结果:",result);
});
});

//管理员功能,处理有些订单没有处理
AV.Cloud.define('queryWeChatOrder',function(request, response)
{
  if (process.env.LEANCLOUD_APP_ENV != 'stage') 
  {
    response.error('这是管理功能,普通用户无法使用!');
    return;
  }
  var wxpay = WXPay({
    appid: 'wxf3633e02a28d60f0',
    mch_id: '1364004502',
    partner_key: 'jiudianZxcvbnmDSAD1weqwkj89991oo' //微信商户平台API密钥
  });
   var queryData = {
    appid: 'wxf3633e02a28d60f0',
    mch_id: '1364004502',
    out_trade_no: request.params.out_trade_no,
    nonce_str:util.generateNonceString()
   }

   var key = 'order,' + request.params.out_trade_no;
   if(reqCount().key)
   {
      response.error('正在处理了,请稍后重试!');
      return;
   }
   reqCount().key = 1;

   wxpay.queryOrder(queryData, function(err, result)
  {
    //response.success(result);
    if(result.return_code == 'SUCCESS')
    {
      if(result.result_code == 'SUCCESS')
      {
        if(result.trade_state == 'SUCCESS')
        {
          var query = new AV.Query('wechatOrder');
          query.equalTo('tradeNo', queryData.out_trade_no);
          query.first().then(function (data)
            {
                var state = data.get('orderState');
                if(state == 0)//支付成功未做处理
                {
                  //成功处理,看看是否会有人多次支付
                  data.increment('orderState', 1);
                  data.save();
                  //此时需要做处理,根据objectID更新用户数据
                  var gold = data.get('goldNum');
                  var diamond = data.get('Diamond');
                  //购买的价值
                  var price = gold/100 + diamond;
                  if (price < 300) 
                  {
                    price *= 0.8;
                  }
                  else
                  {
                    price *= 0.5;
                  }
                  query = new AV.Query('chatUsers');
                  query.equalTo('userID', data.get('userID'));
                  query.first().then(function(avobj)
                    {
                      var goldMax = gold;
                      if(diamond > 0)
                      {
                        gold += diamond * 100;
                      }
                      var vipType = avobj.get("VIPType");
                      if (vipType > 0 && price < 300)//购买在300以下 
                      {
                          var tip = [1.0,1.05,1.08,1.12,1.18,1.25,1.33,1.42,1.52,1.63];
                          gold *= tip[vipType];
                          diamond *= tip[vipType];
                      }
                      //写一下充值记录
                      
                      var log = new rechargeLog();
                      log.set('beforeGold', avobj.get('goldNum'));
                      log.set('beforeGoldMax', avobj.get('goldMax'));
                      log.set('beforeDiamond', avobj.get('Diamond'));
                      //写入数据库
                      avobj.increment('goldMax', parseInt(goldMax));
                      avobj.increment('Diamond', parseInt(diamond));
                      avobj.increment('goldNum',parseInt(gold));
                      avobj.increment('BonusPoint', price);
                      avobj.save();

                      //记录订单号
                      log.set('tradeNo', queryData.out_trade_no);
                      //记录用户id
                      log.set('userID', avobj.get('userID'));
                      //记录购买物品
                      log.set('goldMax', goldMax);
                      log.set('goldNum', gold);
                      log.set('Diamond', diamond);
                      log.set('vipType', vipType);
                      log.set('money', price);//实际支付金额
                      log.save();
                      response.success('充值成功!');
                    });
                }
            }, function (error) 
            {
              response.error(error);
            }
          );
        }
        else
        {
          response.error(result.trade_state);
        }
      }
      else
      {
        response.error(result.err_code_des);
      }
    }
    else
    {
      response.error(result.return_msg);
    }
});

});
function getProductInfo(identify)
{
  if(identify == 'com.starfire.intheworld.goldNum100')
  {
   return {goldNum:100,goldMax:100, money:1};
  }
  else if(identify == 'com.starfire.intheworld.gold1500')
  {
    return {goldNum:1500, goldMax:1500, money:12};
  }
  else if(identify == 'com.starfire.intheworld.gold8000')
  {
    return {goldNum:8000, goldMax:8000, money:68};
  }
  else if(identify == 'com.starfire.intheworld.gold600')
  {
    return {goldNum:600, goldMax:600, money:6};
  }
  else if(identify == 'com.starfire.intheworld.diamond6')
  {
    return {diamond:6, goldNum:600, money:6};
  }
  else if(identify == 'com.starfire.intheworld.diamond20')
  {
    return {diamond:20, goldNum:2000, money:18};
  }
  else if(identify == 'com.starfire.intheworld.diamond80')
  {
    return {diamond:80, goldNum:8000, money:68};
  }
  else if(identify == 'com.starfire.intheworld.diamond120')
  {
    return {diamond:120, goldNum:12000, money:98};
  }
  else if(identify == 'com.starfire.intheworld.diamond200')
  {
    return {diamond:200, goldNum:20000, money:168};
  }
  else if(identify == 'com.starfire.intheworld.diamond600_1')
  {
    return {diamond:600, goldNum:60000, money:468};
  }
  else
  {
    return {};
  }
}
AV.Cloud.define('payCheck', function(request, response)
{
  var vip = [1.0, 1.05, 1.08, 1.12, 1.18, 1.25, 1.33, 1.42, 1.52, 1.63, 1.63, 1.63, 1.63];
  var version = request.params.version;
  if(version == 0)
  {
      var identify = request.params.identifier;
      var product = getProductInfo(identify);
      if(!product.goldNum && !product.goldMax && !product.diamond)
      {
        return response.error('查询失败,请联系客服!');
      }
      var goldNum = product.goldNum || 0;
      var goldMax = product.goldMax || 0;
      var Diamond = product.diamond || 0;
      var money = product.money || 0;
      return new AV.Query('chatUsers').equalTo('userID', request.params.userID).first().then(function(data)
      {
        if(!data)
        {
          return response.error('用户读取失败!');
        }
        var increase = vip[common.getVipType(data.get('BonusPoint'))];
        goldNum = parseInt(goldNum*increase);
        Diamond = parseInt(Diamond * increase);
        goldMax = parseInt(goldMax * increase);
        data.increment('goldNum', goldNum);
        data.increment('goldMax', goldMax);
        data.increment('Diamond', Diamond);
        data.increment('BonusPoint', money);
        return data.save();
      }).then(function(success)
      {
        response.success({'goldNum':goldNum, 'goldMax':goldMax, 'Diamond':Diamond});
        var log = new IAPInfo();
        log.set('userid', request.params.userID);
        log.set('product', identify);
        log.set('goldNum', goldNum);
        log.set('Diamond', Diamond);
        log.set('goldMax', goldMax);
        log.set('version', version);
        log.set('money', money);
        log.save();
      }).catch(function(error)
      {
        return response.error('查询用户失败!');
      });
  }
  else
  {
    AV.Cloud.httpRequest({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  url: request.params.url,
  body: request.params.receiptdata,
  success: function(httpResponse) {
    if(!version)
    {
      console.log('Request succ ' + httpResponse.text);
      response.success(httpResponse.text);
    }
    else if(version == 1)
    {
      var data = JSON.parse(httpResponse.text);
      var identify = data.product_id;
      var product = getProductInfo(identify);
      if(!product.goldNum && !product.goldMax && !product.diamond && !product.money){
        return response.error('查询失败,请联系客服!');
      }
      var goldNum = product.goldNum || 0;
      var goldMax = product.goldMax || 0;
      var Diamond = product.diamond || 0;
      var money = product.money || 0;
      return new AV.Query('chatUsers').equalTo('userID', request.params.userID).first().then(function(data)
      {
        if(!data)
        {
          return response.error('用户读取失败!');
        }
        var increase = vip[common.getVipType(data.get('BonusPoint'))];
        goldNum = parseInt(goldNum*increase);
        Diamond = parseInt(Diamond * increase);
        goldMax = parseInt(goldMax * increase);
        data.increment('goldNum', goldNum);
        data.increment('goldMax', goldMax);
        data.increment('Diamond', Diamond);
        data.increment('BonusPoint', money);
        return data.save();
      }).then(function(success)
      {
        response.success({'goldNum':goldNum, 'goldMax':goldMax, 'Diamond':Diamond});
        var log = new IAPInfo();
        log.set('userid', request.params.userID);
        log.set('product', request.params.identify);
        log.set('goldNum', goldNum);
        log.set('Diamond', Diamond);
        log.set('goldMax', goldMax);
        log.set('version', version);
        log.set('money', money);
        log.save();
      }).catch(function(error)
      {
        return response.error('查询用户失败!');
      });
    }
   
  },
  error: function(httpResponse) {
    console.error('Request failed with response code ' + httpResponse.status);
    response.error(httpResponse.status);
  }
});
  }
  
});

AV.Cloud.define('clearQD', function(request, response) {
// 知道 objectId，创建 AVObject
 var post = AV.Object.createWithoutData('qianDaoInfo', '556347fde4b0fa5c84ebae71');
// 更改属性
 post.set('qdIDs', '');
 post.set('goldGet', '');
 post.set('goldmaxGet', '');
 post.set('likeGet', '');
 post.set('qdTotal', 0);
// 保存
 post.save();

// 知道 objectId，创建 AVObject
 var post = AV.Object.createWithoutData('chatUsers', '563daf0560b25b79e633239b');
// 更改属性
 post.set('dailylike', 0);
// 保存
 post.save();
});


AV.Cloud.define('closeSoc', function(request, response) 
{
  // 知道 objectId，创建 AVObject
	var post1 = AV.Object.createWithoutData('groupInfo','55e6f7c060b2fe714836657b');
// 更改属性
post1.set('bshow', 0);
// 保存
post1.save();

// 知道 objectId，创建 AVObject
var post2 = AV.Object.createWithoutData('groupInfo', '55e6f7a5ddb255ed2dfa6566');
// 更改属性
post2.set('bshow', 0);
// 保存
post2.save();

// 知道 objectId，创建 AVObject
var post3 = AV.Object.createWithoutData('groupInfo', '55e6fab660b2fe714836c969');
// 更改属性
post3.set('bshow', 0);
// 保存
post3.save();


// 知道 objectId，创建 AVObject
var post4 = AV.Object.createWithoutData('groupInfo', '55e6f7b160b291d78509b667');
// 更改属性
post4.set('bshow', 0);
// 保存
post4.save();

// 知道 objectId，创建 AVObject
var post4 = AV.Object.createWithoutData('groupInfo', '5660ea4560b2febe2f786bdd');
// 更改属性
post4.set('bshow', 0);
// 保存
post4.save();
});

AV.Cloud.define('openSo', function(request, response) 
{
// 知道 objectId，创建 AVObject
var post1 = AV.Object.createWithoutData('groupInfo', '55e6f7c060b2fe714836657b');
// 更改属性
post1.set('bshow', 1);
// 保存
post1.save();

// 知道 objectId，创建 AVObject
var post2 = AV.Object.createWithoutData('groupInfo', '55e6f7a5ddb255ed2dfa6566');
// 更改属性
post2.set('bshow', 1);
// 保存
post2.save();

// 知道 objectId，创建 AVObject
var post3 = AV.Object.createWithoutData('groupInfo', '55e6fab660b2fe714836c969');
// 更改属性
post3.set('bshow', 1);
// 保存
post3.save();


// 知道 objectId，创建 AVObject
var post4 = AV.Object.createWithoutData('groupInfo', '55e6f7b160b291d78509b667');
// 更改属性
post4.set('bshow', 1);
// 保存
post4.save();

// 知道 objectId，创建 AVObject
var post4 = AV.Object.createWithoutData('groupInfo', '5660ea4560b2febe2f786bdd');
// 更改属性
post4.set('bshow', 1);
// 保存
post4.save();
});

AV.Cloud.define('destroyAnonymous', function(request, response) {
console.log('start close anonymous ');
// 知道 objectId，创建 AVObject
var post1 = AV.Object.createWithoutData('groupInfo', '5677698460b2260ee44a6ae8');
// 更改属性
post1.set('bCanCreate', 0);
// 保存
post1.save();
});

AV.Cloud.define('openAnonymous', function(request, response) {
// 知道 objectId，创建 AVObject
var post1 = AV.Object.createWithoutData('groupInfo', '5677698460b2260ee44a6ae8');
// 更改属性
post1.set('bCanCreate',1);
// 保存
post1.save();
});

AV.Cloud.define('clearXZQD', function(request, response) {
console.log('start clearXZQD');

var query = new AV.Query('groupInfo');
query.equalTo('Type', 1);
query.find({
  success: function(results) {
    console.log('Successfully retrieved ' + results.length + ' posts.');
    // 处理返回的结果数据
    for (var i = 0; i < results.length; i++) {
      var object = results[i];
      var content = object.get('signCount');
    object.set('lastDaySign', content);
    object.set('signCount', 0);
    object.save();
    }
  },
  error: function(error) {
    console.log('Error: ' + error.code + ' ' + error.message);
  }
});

console.log('end clearXZQD');
});

AV.Cloud.define('logUser', function(request, response) {
var query = new AV.Query('chatUsers');
query.equalTo('userID', 266392);
query.find({
  success: function(results) {
    console.log('Successfully retrieved ' + results.length + ' posts.');
    var Post = AV.Object.extend('checkUser');
    // 处理返回的结果数据
    for (var i = 0; i < results.length; i++) {
      var object = results[i];
      var post = new Post();

content = object.get('userID');
      post.set('userID', content);
      var content = object.get('userID');
      post.set('userID', content);
      content = object.get('goldNum');
      post.set('goldNum', content);
      content = object.get('goldMax');
      post.set('goldMax', content);
      content = object.get('Diamond');
      post.set('Diamond', content);
      content = object.get('beLikedNum');
      post.set('beLikedNum', content);
      content = object.get('dailyUseGold');
      post.set('dailyUseGold', content);
      content = object.get('dailygood');
      post.set('dailygood', content);
      content = object.get('dailylike');
      post.set('dailylike', content);
      content = object.get('greatNum');
      post.set('greatNum', content);
      content = object.get('useGold');
      post.set('useGold', content);
    
      post.save();
    }
  },
  error: function(error) {
    console.log('Error: ' + error.code + ' ' + error.message);
  }
});

var query = new AV.Query('chatUsers');
query.equalTo('userID', 99296);
query.find({
  success: function(results) {
    console.log('Successfully retrieved ' + results.length + ' posts.');
    var Post = AV.Object.extend('checkUser');
    // 处理返回的结果数据
    for (var i = 0; i < results.length; i++) {
      var object = results[i];
      var post = new Post();

content = object.get('userID');
      post.set('userID', content);
      var content = object.get('userID');
      post.set('userID', content);
      content = object.get('goldNum');
      post.set('goldNum', content);
      content = object.get('goldMax');
      post.set('goldMax', content);
      content = object.get('Diamond');
      post.set('Diamond', content);
      content = object.get('beLikedNum');
      post.set('beLikedNum', content);
      content = object.get('dailyUseGold');
      post.set('dailyUseGold', content);
      content = object.get('dailygood');
      post.set('dailygood', content);
      content = object.get('dailylike');
      post.set('dailylike', content);
      content = object.get('greatNum');
      post.set('greatNum', content);
      content = object.get('useGold');
      post.set('useGold', content);
    
      post.save();
    }
  },
  error: function(error) {
    console.log('Error: ' + error.code + ' ' + error.message);
  }
});

var query = new AV.Query('chatUsers');
query.equalTo('userID', 87001);
query.find({
  success: function(results) {
    console.log('Successfully retrieved ' + results.length + ' posts.');
    var Post = AV.Object.extend('checkUser');
    // 处理返回的结果数据
    for (var i = 0; i < results.length; i++) {
      var object = results[i];
      var post = new Post();

content = object.get('userID');
      post.set('userID', content);
      var content = object.get('userID');
      post.set('userID', content);
      content = object.get('goldNum');
      post.set('goldNum', content);
      content = object.get('goldMax');
      post.set('goldMax', content);
      content = object.get('Diamond');
      post.set('Diamond', content);
      content = object.get('beLikedNum');
      post.set('beLikedNum', content);
      content = object.get('dailyUseGold');
      post.set('dailyUseGold', content);
      content = object.get('dailygood');
      post.set('dailygood', content);
      content = object.get('dailylike');
      post.set('dailylike', content);
      content = object.get('greatNum');
      post.set('greatNum', content);
      content = object.get('useGold');
      post.set('useGold', content);
    
      post.save();
    }
  },
  error: function(error) {
    console.log('Error: ' + error.code + ' ' + error.message);
  }
});

var query = new AV.Query('chatUsers');
query.equalTo('userID', 300922);
query.find({
  success: function(results) {
    console.log('Successfully retrieved ' + results.length + ' posts.');
    var Post = AV.Object.extend('checkUser');
    // 处理返回的结果数据
    for (var i = 0; i < results.length; i++) {
      var object = results[i];
      var post = new Post();

content = object.get('userID');
      post.set('userID', content);
      var content = object.get('userID');
      post.set('userID', content);
      content = object.get('goldNum');
      post.set('goldNum', content);
      content = object.get('goldMax');
      post.set('goldMax', content);
      content = object.get('Diamond');
      post.set('Diamond', content);
      content = object.get('beLikedNum');
      post.set('beLikedNum', content);
      content = object.get('dailyUseGold');
      post.set('dailyUseGold', content);
      content = object.get('dailygood');
      post.set('dailygood', content);
      content = object.get('dailylike');
      post.set('dailylike', content);
      content = object.get('greatNum');
      post.set('greatNum', content);
      content = object.get('useGold');
      post.set('useGold', content);
    
      post.save();
    }
  },
  error: function(error) {
    console.log('Error: ' + error.code + ' ' + error.message);
  }
});

var query = new AV.Query('chatUsers');
query.equalTo('userID', 248330);
query.find({
  success: function(results) {
    console.log('Successfully retrieved ' + results.length + ' posts.');
    var Post = AV.Object.extend('checkUser');
    // 处理返回的结果数据
    for (var i = 0; i < results.length; i++) {
      var object = results[i];
      var post = new Post();

content = object.get('userID');
      post.set('userID', content);
      var content = object.get('userID');
      post.set('userID', content);
      content = object.get('goldNum');
      post.set('goldNum', content);
      content = object.get('goldMax');
      post.set('goldMax', content);
      content = object.get('Diamond');
      post.set('Diamond', content);
      content = object.get('beLikedNum');
      post.set('beLikedNum', content);
      content = object.get('dailyUseGold');
      post.set('dailyUseGold', content);
      content = object.get('dailygood');
      post.set('dailygood', content);
      content = object.get('dailylike');
      post.set('dailylike', content);
      content = object.get('greatNum');
      post.set('greatNum', content);
      content = object.get('useGold');
      post.set('useGold', content);
    
      post.save();
    }
  },
  error: function(error) {
    console.log('Error: ' + error.code + ' ' + error.message);
  }
});
});

AV.Cloud.define('clearChatHis', function(request, response) {
var query = new AV.Query('Attachments');
query.addAscending('createdAt');
query.limit(1000);
query.find({
  success: function(results) {
    console.log('Successfully retrieved ' + results.length + ' posts.');
    // 处理返回的结果数据
    for (var i = 0; i < results.length; i++) {
      var object = results[i];
      var file=object.get('image');
      file.destroy();
    }
  },
  error: function(error) {
    console.log('Error: ' + error.code + ' ' + error.message);
  }
});
});

AV.Cloud.define('clearBadData', function(request, response) {
var query = new AV.Query('package');
query.lessThanOrEqualTo('itemCount', 0);
query.find({
  success: function(results) {
    console.log('Successfully retrieved ' + results.length + ' posts.');
    // 处理返回的结果数据
    for (var i = 0; i < results.length; i++) {
      var object = results[i];
      
      object.destroy();
      
      
    }
  },
  error: function(error) {
    console.log('Error: ' + error.code + ' ' + error.message);
  }
});
});

AV.Cloud.define('logRank', function(request, response) {
var query = new AV.Query('chatUsers');
query.limit(10);
query.descending('dailylike');
query.find({
  success: function(results) {
    // 处理返回的结果数据
    for (var i = 0; i < results.length; i++) {
      var object = results[i];
      var post = new Post();
      content = object.get('userID');
      post.set('userID', content);
      var content = object.get('dailylike');
      post.set('dailylike', content);
      post.set('rankType', '日魅力榜');
    
      post.save();
    }
  },
  error: function(error) {
    console.log('Error: ' + error.code + ' ' + error.message);
  }
});
});

//微信下单
AV.Cloud.define('WeChatCreateOrder', function(request, response)
{
  //此种充值方式废弃
  //return response.error('Error');
  var wxpay = WXPay({
    appid: 'wxf3633e02a28d60f0',
    mch_id: '1364004502',
    partner_key: 'jiudianZxcvbnmDSAD1weqwkj89991oo' //微信商户平台API密钥
  });
  //客户端IP
  var clientIP = request.meta.remoteAddress;
  //request.params.spbill_create_ip = clientIP;
  //request.params.notify_url = "http://asplp.leanapps.cn/pay";
  var fee = request.params.fee * 100;
  var type = request.params.type;
  var userid = request.params.userid;
  var notifyurl = 'http://asplp.leanapp.cn/pay';
  if (process.env.LEANCLOUD_APP_ENV == 'stage') 
  {
    notifyurl ='http://stg-asplp.leanapp.cn/pay';
    fee = 1;
  }
  //console.log(notifyurl);
  var date = new Date();

  var orderData = 
  {
    appid:'wxf3633e02a28d60f0',
    body:'有朋充值',
    mch_id:"1364004502",
    total_fee:fee,
    notify_url:notifyurl,
    out_trade_no: Math.floor((date.getTime()+Math.random())*1000).toString(),
    nonce_str:util.generateNonceString(),
    attach:userid.toString(), 
    spbill_create_ip : clientIP,
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
      //
      //var WeChatOrder = AV.Object.extend('wechatOrder');
      var order = new WeChatOrder();
      //记录订单号
      order.set('tradeNo', orderData.out_trade_no);
      //记录用户id
      order.set('userID', userid);
      //记录订单状态 0-下单
      order.set('orderState', 0);
      //记录购买物品
      order.set('needFee', fee / 100);
      order.set('type', type);
      order.save();
    }
    else
    {
      response.error(result.return_msg);
    }
    //console.log("统一下单结果:",result);
});
});

module.exports = AV.Cloud;
