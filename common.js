var AV = require('leanengine');
var uuid = require('uuid');
exports.checkDaySame = function checkDaySame(date, now)
{
	return date.getFullYear() == now.getFullYear() && date.getMonth() == now.getMonth() && date.getDate() == now.getDate();
}

exports.initGiftInfo = function initGiftInfo()
{
	new AV.Query('GiftInfo').find().then(function(results)
	{
		for (var i = results.length - 1; i >= 0; i--) {
			var data = results[i];
			global.giftInfo[data.get('GiftID')] = JSON.stringify(data);
		}
	});
};

exports.getVipType =function getVipType(points)
{
	if(points <= 0)
	{	
        return 0;
    }
    else if(points < 100)
   	{
        return 1;
    }
    else if(points < 500)
    {
        return 2;
     }else if(points < 1500)
     {
        return 3;
     }
    else if(points < 5000)
    {
        return 4;
    }
    else if(points < 10000)
    {
       	return 5;
    }
    else if(points < 20000)
    {
        return 6;
    }
    else if(points < 40000)
    {
        return 7;
    }
    else if(points < 70000)
    {
        return 8;
    }
    else if(points < 120000)
    {
        return 9;
    }
    else 
    	return 10;
}
exports.createToken = function createToken()
{
	var token = uuid.v4();
	token = token.split('-').join('');
	return token;
}
exports.getGoodReview = function(value)
{
    if(value == 0)
    {
        return {goldNum:80};
    }
    else if(value == 10)
    {
        return {goldNum:130};
    }
    else if(value == 30)
    {
        return {goldNum:230};
    }
    else if(value == 50)
    {
        return {goldNum:330};
    }
    else if(value < 100)
    {
        return {goldNum:30};
    }
    else if(value == 100)
    {
        return {goldNum:530};
    }
    else if(value < 300)
    {
        return {goldNum:50};
    }
    else if(value < 500)
    {
        return {goldNum:100};
    }
    else if(value < 1000)
    {
        return {goldNum:150, goldMax:50};
    }
    else if(value < 2000)
    {
        return {goldNum:200, goldMax:100};
    }
    else if(value < 5000)
    {
        return {goldNum:400, goldMax:200};
    }
    else if(value < 10000)
    {
        return {goldNum:500, goldMax:500};
    }
    else if(value < 20000)
    {
        return {goldNum:700, goldMax:700};
    }
    else if(value < 50000)
    {
        return {goldNum:1000, goldMax:1000};
    }
};

exports.getBadReview = function(value)
{
    if(value < 10)
    {
        return {goldNum:-50};
    }
    else if(value < 50)
    {
        return {goldNum:-100};
    }
    else if(value < 100)
    {
        return {goldNum:-200};
    }
    else if(value < 200)
    {
        return {goldNum:-400};
    }
    else if(value < 500)
    {
        return {goldNum:-500}
    }
    else if(value < 1000)
    {
        return {goldNum:-1000};
    }
    else if(value < 10000)
    {
        return {goldNum:-2000};
    }
    else
    {
        return {goldNum: -5000};
    }
}
exports.getMapSilver = function(mapID)
{
    if(mapID <= 0)
    {
        return 0;
    }
    if(mapID <= 30)
    {
        return mapID*50;
    }
    else if(mapID < 40)
    {
        return mapID*50 + (mapID-30) * 25;
    }
    else if(mapID > 1000 && mapID <1009)
    {
        return (mapID-1000)*1000;
    }
    else
    {
        return 0;
    }
}
exports.FormatDate = function(date)
{
    var ret = date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate() + ' ' + date.getHours()+':'+
    date.getMinutes()+':'+date.getSeconds();
    console.log(ret);
    return ret;
}