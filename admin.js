var AV = require('leanengine');
//var reqCount = require('./reqCount');
var TUPU = require('tupu-node-sdk');

global.reqCenter = {};
function reqCount()
{
	return global.reqCenter;
}
var redisClient = require('./redis').redisClient;
var common = require('./common');
var WXPay = require('./lib/wxpay');
var util = require('./lib/util');
var md5 = require('MD5');
var crypto = require('crypto');
var fs = require("fs");
var moment = require('moment');

AV.Cloud.define('clearPlant', function(request, response)
{
	var userID = request.params.userID;
	return new AV.Query('building').equalTo('buildingType', 3).equalTo('userID', userID).equalTo('isLock', 0).find().then(function(results){
		
		var buildings = new Array();
		for (var i = results.length - 1; i >= 0; i--) 
		{
			var data = results[i];
			var plantTime = data.get('plantTime');
			var now = parseInt(new Date().getTime()/1000);
			var plant = data.get('plant');
			if (plant == 0)
			{
				continue;
			}
			if (now - plantTime > (8 * plant + 4) * 3600)
			{
				buildings.push('Plant:'+data.get('buildingNo'));
			}
		}
		console.log(buildings);
		if (buildings.length == 0)
		{
			return null;
		}
		else
		{
			for (var i = buildings.length - 1; i >= 0; i--) {
				redisClient.delAsync(buildings[i]);
			}
		}
		response.success('处理完成!');
	}).catch(function(error)
	{
		response.error(error);
	});
});

AV.Cloud.define('delUserAnchor', function(request, response)
{
	var userID = request.params.userID;
	return new AV.Query('anchorRoom').equalTo('userID', userID).find().then(function(results)
	{
		return AV.Object.destroyAll(results);
	});
})

module.exports = AV.Cloud;