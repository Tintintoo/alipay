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
    else
    {
        return {goldNum:-200};
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
    return ret;
}
exports.getBuildingItemPrice = function(itemID, itemType)
{
    if(itemType == 2)
    {
        var floor = [{gold:100, name:'简易路面'},{gold:300, name:'长草路面'},{gold:500, name:'园石路面'},
        {gold:1000, name:'砖石路面'},{gold:2000, name:'广场'},{gold:1000, name:'粉色拼接'},{gold:500, name:'密集砖石'},
        {gold:3000, name:'星星闪光'},{gold:1500, name:'冰冻路面'},{diamond:15, name:'熊出没'},{diamond:20, name:'金光闪闪'},
        {gold:1500, name:'高速公路'},{diamond:30, name:'奢华路面'}];
        if(itemID >= 1 && itemID <= 13)
        {
            return floor[itemID-1];
        }
        else
        {
            return {};
        }
    }
    else if(itemType == 4)
    {
        var decorate = [{gold:200, name:'灌木丛'},{gold:500, name:'大树'},{gold:1000, name:'竹子'},
        {gold:1000, name:'树丛'},{gold:1500, name:'路灯'},{gold:1500, name:'花丛'},{gold:2000, name:'红花'},
        {diamond:99, name:'爱情树'}];
        if(itemID >= 1 && itemID <= 8)
        {
            return decorate[itemID -1];
        }
        else
        {
            return {};
        }
    }
    else if(itemType == 3)
    {
        var plant = [{gold:300,count:12},{gold:500,count:14},{gold:1500,count:16},{gold:2700,count:18},{gold:5000,count:20}
        ,{gold:8000, count:22},{gold:12000,count:24},{gold:15000,count:26},{gold:20000,count:28},{gold:30000, count:30}];
        if(itemID >= 1 && itemID <= 10)
        {
            return plant[itemID -1];
        }
        else
        {
            return {};
        }
    }
    return {};
}
exports.getBuildingExp = function(nLevel)
{
    if (nLevel <= 0)
    {
        return 0;
    }
    if (nLevel == 1)
    {
        return 60;
    }
    if (nLevel == 2)
    {
        return 200;
    }
    if (nLevel == 3)
    {
        return 500;
    }
    if (nLevel == 4)
    {
        return 1000;
    }
    if (nLevel == 5)
    {
        return 2000;
    }
    if (nLevel == 6)
    {
        return 5000;
    }
    if (nLevel == 7)
    {
        return 10000;
    }
    if (nLevel == 8)
    {
        return 20000;
    }
    if (nLevel == 9)
    {
        return 40000;
    }
    if(nLevel ==10)
    {
        return 100000;
    }
    if(nLevel == 11)
    {
        return 200000;
    }
    if(nLevel == 12)
    {
        return 300000;
    }
    if(nLevel == 13)
    {
        return 500000;
    }
    if(nLevel == 14)
    {
        return 1000000;
    }
}
exports.getExpandPrice=function(value)
{
    var floor = {1:{gold:100}, 24:{gold:500}, 47:{gold:1000}, 8:{gold:2000}, 23:{gold:5000}, 46:{gold:10000}, 
    7:{gold:40000}, 22:{gold:80000}, 45:{gold:200000}};
    return floor[value];
}
exports.getGoldIncrease= function(type , level)
{
    if(type == 0)
    {
        return 2 + level;
    }
    else if(type == 1)
    {
        return parseInt(4 + level * 1.5);
    }
    else if(type == 2)
    {
        return parseInt(6 + level * 2);
    }
    else if(type == 3)
    {
        return parseInt(8 + level * 2.5);
    }
    else
    {
        return parseInt(10 + level * 3);
    }
}
exports.stringToDate= function(value)
{
    return new Date(value.replace(/-/g,"/"));
}