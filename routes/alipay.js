'use strict';
var router = require('express').Router();
var alipay = require('../utils/alipay');
var common = require('../common');
var crypto = require('crypto');
var redisClient = require('../redis').redisClient;
var AV = require('leanengine');
var rechargeLog = AV.Object.extend('rechargeLog');

function verfy(resData)
{
	var realstring = common.JointJson(resData, false, ['sign', 'sign_type']);
	var decodeStr = decodeURIComponent(realstring);
	//支付宝公钥
	var publicKey = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDDI6d306Q8fIfCOaTXyiUeJHkrIvYISRcc73s3vF1ZT7XN8RNPwJxo8pWaJMmvyTn9N4HQ632qJBVHf8sxHi/fEsraprwCtzvzQETrNRwVxLO5jVmRGi60j8Ue1efIlzPXV9je9mkjzOmdssymZkh2QhUrCmZYI/FCEa3/cNMW0QIDAQAB\n-----END PUBLIC KEY-----';
	var sign = new Buffer(resData.sign, 'base64');
	var verfy = crypto.createVerify('RSA-SHA1');
	verfy.update(decodeStr,'utf8');
	return verfy.verify(publicKey, sign);
}
router.post('/', function(req, res) 
{
	req.headers['content-type'] = 'application/x-www-form-urlencoded';
	var resData = req.body;
	//校验通过,此时去查询一下数据库
	if (verfy(resData)== true)
	{
		if (resData.app_id != '2016071301613150' || 
			resData.seller_email != '83185063@qq.com' || 
			resData.seller_id != '2088421459188431')
		{
			console.log('有异常订单!', realstring);
			return ;
		}
		var key = 'aliPayorder:'+ resData.out_trade_no;
		//控制访问
		redisClient.incr(key,function( err, id ) 
		{
			if(id > 1)
			{
				console.log('已经处理过了,不再处理');
				return ;
			}
			redisClient.expire(key, 60);
			var order;
			var step = 0;
			if (resData.trade_status != 'TRADE_SUCCESS')
			{
				console.log('交易失败!');
				return;
			}
			var log = new rechargeLog();
			log.set('payType', 'AliPay');
			var type = 0;
			var userID = 0;
			var goldNum = 0;
			var Diamond = 0;
			var cash = 0;
			var total_fee = parseFloat(resData.buyer_pay_amount);
			if (process.env.LEANCLOUD_APP_ENV == 'stage') 
			{
				total_fee = 100;
			}
			return new AV.Query('alipayOrder').equalTo('tradeNo', resData.out_trade_no).first().then(function(data)
			{
				if (!data)
				{
					return AV.Promise.error('未查询到订单信息');
				}
				if (data.get('orderState') == 1)
				{
					return AV.Promise.error('over');
				}
				data.set('realPay', total_fee);
				data.set('receipt', parseFloat(resData.receipt_amount));
				data.set('aliTradeNo', resData.trade_no);
				data.increment('orderState', 1);
				type  = data.get('type');
				userID = data.get('userID');
				return data.save();
			}).then(function(success)
			{
				return new AV.Query('chatUsers').equalTo('userID', userID).first();
			}).then(function(data)
			{
				if (!data)
				{
					return AV.Promise.error('用户查询失败!');
				}
				var vipType = data.get("VIPType");
				var tip = [1.0,1.05,1.08,1.12,1.18,1.25,1.33,1.42,1.52,1.63, 1.63];

	            //写一下充值记录
                log.set('beforeGold', data.get('goldNum'));
                log.set('beforeGoldMax', data.get('goldMax'));
                log.set('beforeDiamond', data.get('Diamond'));
                log.set('beforeBonus', data.get('BounusPoint'));
                log.set('Bounus', parseInt(total_fee));
                log.set('cashBefore', data.get('cash'));
                var bonus = 0;
                if(type == 1)//充值金币
            	{
            		goldNum = total_fee * 300;
            		if(total_fee < 300)
            		{
            			goldNum *= 1.25;
            			goldNum *= tip[vipType];
            		}
            		else
            		{
            			goldNum *= 2;
            		}
            		data.increment('goldMax', parseInt(goldNum));
            		data.increment('Diamond', Math.floor(total_fee/500) * 88);
            		data.increment('goldNum',parseInt(goldNum));
            		bonus = 1;
            	}
            	else if (type == 2)
            	{
            		Diamond = total_fee;
            		if(total_fee < 300)
            		{
            			Diamond *= 1.25;
            			Diamond *= tip[vipType];
            		}
            		else
            		{
            			Diamond *= 2;
            		}
            		data.increment('Diamond', Diamond + Math.floor(total_fee/500) * 88);
            		data.increment('goldNum',parseInt(Diamond * 100));
            		bonus = 1;
            	}
            	else
            	{
            		cash = total_fee;
            		data.increment('cash', cash * 100);
            	}
            	if (type == 1 || type == 2)
            	{
            		data.increment('BonusPoint', parseInt(total_fee));
            	}
            	
            	//记录订单号
	            log.set('tradeNo', resData.out_trade_no);
	            //实际支付金额
	            log.set('money', total_fee);
	              //记录用户id
	            log.set('userID', data.get('userID'));
	              //记录购买物品
	            log.set('goldMax', goldNum);
	            log.set('goldNum', goldNum*3 + Diamond*100);
	            log.set('Diamond', Diamond);
	            log.set('vipType', vipType);
	            data.fetchWhenSave(true);
				return data.save();
			}).then(function(user)
			{
				log.set('cashAfter', user.get('cash'));
				log.set('DiamondAfter',user.get('Diamond'));
				log.set('GoldAfter',user.get('goldNum'));
				log.set('goldMaxAfter',user.get('goldMax'));
				log.set('afterBonus', user.get('BounusPoint'));
				return log.save();
			}).catch(function(error)
			{
				log.set('error', error);
				return log.save();
			})
		});
	}

});


module.exports = router;