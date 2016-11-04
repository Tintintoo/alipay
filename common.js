var AV = require('leanengine');
var uuid = require('uuid');

exports.checkDaySame = function checkDaySame(date, now)
{
	return date.getFullYear() == now.getFullYear() && date.getMonth() == now.getMonth() && date.getDate() == now.getDate();
}
exports.JointJson = function(reqData, encode, arrSkip)
{
    var array = arrSkip || ['pfx', 'partner_key', 'sign', 'key'];
    var querystring = Object.keys(reqData).filter(function(key)
    {
        return reqData[key] !== undefined && reqData[key] !== '' && array.indexOf(key)<0;
        }).sort();
    var realstring='';
    for(var key in querystring)
    {
        if (encode)
        {
            realstring += querystring[key] + '=' + encodeURIComponent(reqData[querystring[key]]) + '&';
        }
        else
        {
            realstring += querystring[key] + '=' + reqData[querystring[key]] + '&';
        }
    }
    realstring = realstring.substr(0, realstring.length-1);
    return realstring;
}
exports.checkDayGreater = function(date, now)
{
    if(!date)
    {
        return false;
    }
    return date.getTime() > now.getTime();
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
        return mapID * 50;
    }
    else if(mapID < 40)
    {
        return mapID * 50 + (mapID-30) * 25;
    }
    else if(mapID > 1000 && mapID <1009)
    {
        if(mapID == 1001)
        {
            return 2000;
        }
        else if(mapID == 1002)
        {
            return 3000;
        }
        else if(mapID == 1003)
        {
            return 5000;
        }
        else if(mapID == 1004)
        {
            return 7000;
        }
        else if(mapID == 1005)
        {
            return 8000;
        }
        else if(mapID == 1006)
        {
            return 10000;
        }
    }
    else
    {
        return 0;
    }
}
exports.FormatDate = function(date)
{
    var ret = date.getFullYear()+"-";
    if (date.getMonth() +1 < 10)
    {
        ret += '0' ;
    }
    ret += (date.getMonth() + 1) + '-';
    if (date.getDate() < 10)
    {
        ret += '0';
    }
    ret += date.getDate() + ' ';
    if (date.getHours() < 10)
    {
        ret += '0';
    }
    ret += date.getHours() +':';
    if (date.getMinutes() < 10)
    {
        ret += '0';
    }
    ret += date.getMinutes()+':';
    if (date.getSeconds() < 10)
    {
        ret += '0';
    }
    ret += date.getSeconds();
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
    return 500 + level * 20;
}
exports.stringToDate= function(value)
{
    if(!value || value.length <= 0)
    {
       return new Date(new Date().getTime() - 86400000);
    }
    var date = value.replace(/-/g,"/");
    if(date.length <= 9 && date.length > 0)
    {
        date += ' 00:00:00';
    }
    return new Date(date);
}

exports.addMonth = function(date, month)
{
    var mon = date.getMonth();
    var year = date.getFullYear();
    var day = date.getDate();
    mon += month;
    if(mon > 11)
    {
        mon -= 12;
        year += 1;
    }
    date.setFullYear(year);
    date.setMonth(mon);
    return new Date(date.getTime() - 86400000);
}
exports.getSignReword = function(vipType, day)
{
    var dayReword = [{day:1,gold:100}, {day:2,gold:150}, {day:3,gold:200, goldMax:100,diamond:5}, {day:4,gold:240}, 
    {day:5,gold:300,goldMax:150}, {day:6,gold:350},{day:7,gold:400, goldMax:200, diamond:8},
    {day:8,gold:500}, {day:9,gold:600}, {day:10,gold:700,goldMax:240,diamond:10},
    {day:11,gold:800},{day:12,gold:900,goldMax:300},{day:13,gold:1000},{day:14,gold:1100},{day:15,gold:1200,diamond:20},{day:16,gold:1300},
    {day:17,gold:1500},{day:18,gold:1600,goldMax:400},{day:19,gold:1700},{day:20,gold:2000,goldMax:450, diamond:25},
    {day:21,gold:2100},{day:22,gold:2200},{day:23,gold:2400},{day:24,gold:2500},{day:25,gold:3000,goldMax:600,diamond:30},
    {day:26,gold:3100},{day:27,gold:3200},{day:28,gold:3300},{day:29,gold:3400},{day:30,gold:4000,goldMax:800,diamond:40}];
    var price = dayReword[day];
    price['goldVip'] = Math.floor(price.gold * vipType / 10);
    price['goldMaxVip'] = Math.floor(price.gold * vipType /100);
    return price;
}

exports.getProbility = function(value, type)
{
    if(type == 1)//金币阶梯
    {
        if(value > 500000)
        {
            return 40;
        }
        else if(value > 300000)
        {
            return 30;
        }
        else if(value > 100000)
        {
            return 20;
        }
        else if (value > 30000)
        {
            return 10;
        }
        else 
            return 0;
    }
    else 
    {
        if (value > 5000)
        {
            return 40;
        }
        else if (value > 3000)
        {
            return 30;
        }
        else if (value > 1000)
        {
            return 20;
        }
        else if (value > 300)
        {
            return 10;
        }
        else 
            return 0;
    }
}

exports.getPetGoldMax = function(petType, level)
{
    if (petType == 0)
    {
        return 60 + 50 *level;
    }
    else if (petType == 1)
    {
        return 120 + 100 * level;
    }
    else if (petType == 2)
    {
        return 180 + 150 * level;
    }
    else if (petType == 3)
    {
        return 300 + 200 * level;
    }
    else if (petType == 4)
    {
        return 600 + 300 * level;
    }
}

exports.getLiveRoomGift = function(giftID)
{
    if (giftID == 11000)
    {
        return {gold:1000,charm:500};
    }
    return null;
}