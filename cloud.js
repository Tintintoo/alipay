var AV = require('leanengine');
var WXPay = require('./lib/wxpay');
var util = require('./lib/util');
//var reqCount = reqire('./reqCount');
/**
 * 一个简单的云代码方法
 */
//获取服务器时间
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
  else if(fee < 30000)
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
      var WeChatOrder = AV.Object.extend('wechatOrder');
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
      order.save();
    }
    else
    {
      response.error(result.return_msg);
    }
    //console.log("统一下单结果:",result);
});
});

/*AV.Cloud.define('queryWeChatOrder',function(request, response)
{
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
                      var rechargeLog = AV.Object.extend('rechargeLog');
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
    //console.log("统一下单结果:",result);
});

});*/

AV.Cloud.define('payCheck', function(request, response)
{
  AV.Cloud.httpRequest({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  url: request.params.url,
  body: request.params.receiptdata,
  success: function(httpResponse) {
    console.log('Request succ ' + httpResponse.text);
    response.success(httpResponse.text);
  },
  error: function(httpResponse) {
    console.error('Request failed with response code ' + httpResponse.status);
  }
});
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

module.exports = AV.Cloud;
