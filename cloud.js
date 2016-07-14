var AV = require('leanengine');

/**
 * 一个简单的云代码方法
 */
//获取服务器时间
AV.Cloud.define('getServerTime', function(request, response) 
{
  response.success(new Date());
});
//支付二次检测
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


/*AV.Cloud.define('clearQD', function(request, response) {
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


AV.Cloud.define(‘destroyAnoymous’, function(request, response) 
{
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

AV.Cloud.define('clearBadData', function(request, response)
{
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
});*/

module.exports = AV.Cloud;
