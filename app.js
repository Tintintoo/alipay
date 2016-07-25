'use strict';
var express = require('express');
var bodyParser = require('body-parser');
var WXPay = require("./lib/wxpay");
var cloud = require('./cloud');
var piaoliuping = require('./piaoliuping');

var app = express();

app.use(express.static('public'));

var wxpay = WXPay({
    appid: 'wxf3633e02a28d60f0',
    mch_id: '1364004502',
    partner_key: 'jiudianZxcvbnmDSAD1weqwkj89991oo' //微信商户平台API密钥
  });

// 加载云代码方法
app.use(cloud);
app.use(piaoliuping);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// 可以将一类的路由单独保存在一个文件中


//微信支付返回
app.get('/pay', wxpay.useWXCallback());
app.get('/pay/*', wxpay.useWXCallback());
// 如果任何路由都没匹配到，则认为 404
// 生成一个异常让后面的 err handler 捕获
app.use(function(req, res, next) 
{
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
if (app.get('env') === 'development') 
{
  console.log("app:env");
  app.use(function(err, req, res, next) { // jshint ignore:line
    res.status(err.status || 500);
    res.send({
      message: err.message,
      error: err
    });
  });
}

// 如果是非开发环境，则页面只输出简单的错误信息
app.use(function(err, req, res, next) { // jshint ignore:line
  res.status(err.status || 500);
  res.send({
    message: err.message,
    error: {}
  });
});

module.exports = app;
