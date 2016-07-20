'use strict';
var router = require('express').Router();
var alipay = require('../utils/alipay');

router.post('/', function(req, res) {
  console.log("paynotiy");
});

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
