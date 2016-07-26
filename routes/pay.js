'use strict';
var router = require('express').Router();
var alipay = require('../utils/alipay');
var WXPay = require("../lib/wxpay");
var wxpay = WXPay({
    appid: 'wxf3633e02a28d60f0',
    mch_id: '1364004502',
    partner_key: 'jiudianZxcvbnmDSAD1weqwkj89991oo' //微信商户平台API密钥
  });

router.post('/', wxpay.useWXCallback());

router.get('/return', function(req, res) 
{
  console.log('return query: ', req.query);
  alipay.verify(req.query, function(err, result) {
    console.log('result: ', err, result);
    if (err) {
      return res.send('err: ' + err);
    }
    return res.send('验证结果: ' + result);
  });
});

router.post('/notify', function(req, res) {
  console.log('notify params:', req.params);
  alipay.verify(req.params, function(err, result) {
    console.log('result: ', err, result);
    if (err) {
      return res.send('err: ' + err);
    }
    return res.send('验证结果: ' + result);
  });
});

module.exports = router;
