'use strict';
var AV = require('leanengine');

var APP_ID = process.env.LEANCLOUD_APP_ID|| 'ifmmzg0hwfo69zdho7dwwjlakqupnmjuukcab6pothxs50i0';
var APP_KEY = process.env.LEANCLOUD_APP_KEY|| '0gdj48papdbw5qisfzq1wr4lmlzzpp6ebffiu6rn1voppfb6';
var MASTER_KEY = process.env.LEANCLOUD_APP_MASTER_KEY|| 'j1vyg8hkoqfq2bul6n4ontu2yspylq7lk8nzjsi14ywbfo5r';

AV.initialize(APP_ID, APP_KEY, MASTER_KEY);
AV.Cloud.useMasterKey();

var app = require('./app');

// 端口一定要从环境变量 `LC_APP_PORT` 中获取。
// LeanEngine 运行时会分配端口并赋值到该变量。
var PORT = parseInt(process.env.LEANCLOUD_APP_PORT || 3000);
app.listen(PORT, function () 
{
  console.log('Node app is running, port:', PORT);
});
