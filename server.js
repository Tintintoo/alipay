'use strict';
var AV = require('leanengine');

var APP_ID = process.env.LEANCLOUD_APP_ID;
var APP_KEY = process.env.LEANCLOUD_APP_KEY;
var MASTER_KEY = process.env.LEANCLOUD_APP_PORT;

AV.initialize(APP_ID, APP_KEY, MASTER_KEY);

var app = require('./app');

// 端口一定要从环境变量 `LC_APP_PORT` 中获取。
// LeanEngine 运行时会分配端口并赋值到该变量。
var PORT = parseInt(process.env.LEANCLOUD_APP_PORT || 3000);
app.listen(PORT, function () {
  console.log('Node app is running, port:', PORT);
});
