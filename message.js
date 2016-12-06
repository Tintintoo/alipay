var AV = require('leanengine');
var Realtime = require('leancloud-realtime').Realtime;
var TextMessage = require('leancloud-realtime').TextMessage;
var realtime = new Realtime({
  appId: 'ifmmzg0hwfo69zdho7dwwjlakqupnmjuukcab6pothxs50i0',
  region: 'cn', // 美国节点为 "us"
});

var redisClient = require('./redis').redisClient;
var common = require('./common');


realtime.createIMClient('-1').then(function(tom)
{
	tom.on('message', function(message, conversation)
	{
		console.log(message.from+","+message.cid+","+message.id+","+message.timestamp+","+ message.deliveredAt);
    	console.log('Message received: ' + message.text);
    	return tom.createConversation({members: [message.from.toString()],
   	 									name: 'system',unique: true}).then(function(conversation)
 		{	
 			return conversation.send(new TextMessage(JSON.stringify({'msg':'有疑问可以联系客服小漂!','type' :'text','msgtype':0})));
 		});
  	});
  	tom.getConversation('57d11cefbf22ec005f95feee').then(function(conversation)
  	{
  		return conversation.join();
  	}).then(function(conversation)
  	{
  		console.log('加入成功', conversation.members);
  	}).catch(function(error)
  	{
  		return ;
  	});
});

AV.Cloud.define('sendSysNotice', function(request, response)
{
  var groupID = request.params.groupID;
  var type = request.params.type;
  if (!groupID)
  {
    type = 1;
    groupID = '57d11cefbf22ec005f95feee';
  }
  console.log('sendMessageTo', groupID);
	realtime.createIMClient('-1').then(function(tom)
	{
		return tom.getConversation(groupID);
	}).then(function(conversation)
	{
		return conversation.send(new TextMessage(JSON.stringify({'msg':request.params.message,'type' :'text','msgtype':type})));
	}).catch(function(error)
	{
		return error;
	});
})

AV.Cloud.define('sendMessage', function(request, response)
{
	var client = request.params.userID;
	realtime.createIMClient('-1').then(function(tom)
	{
  		return tom.createConversation(
  		{members: [client.toString()],name: 'system',unique: true}).then(function(conversation) {
  	// 发送消息
  			return conversation.send(new TextMessage(JSON.stringify({'msg':'耗子，起床！','type' :'text','msgtype':0})));
		}).then(function(message)
		{
  			console.log('system', '发送成功！');
		}).catch(console.error);
	});
});


AV.Cloud.define('seatWolfKill', function(request, response)
{
  var roomID = request.params.roomID;
  var userID = request.params.userID;
  var count = request.params.count;
  var groupID = request.params.groupID;
  var key = 'wolfSeat:' + roomID;
  redisClient.incr(key, function(err, id)
  {
    if (err)
    {
      return response.error('上位失败,请退出重进!');
    }
    redisClient.getAsync('wolfKill:' + roomID).then(function(cache)
    {
      var array = new Array();
      var index = 0;
      if (cache)
      {
        array = cache.split(',');
        for (var i = array.length - 1; i >= 0; i--) {
          if (array[i] == userID.toString())
          {
            AV.Cloud.run('sendSysNotice', {'groupID':groupID, 'message':array.join(','), 'type':111});
            return response.success(array);
          }
        }
        for(var i = 0; i < array.length; i++)
        {
          if (array[i] == '0')
          {
            index++;
          }
          if (index >= id)
          {
            array[i] = userID.toString();
            response.success(array);
            break;
          }
          else if (i == array.length - 1)
          {
            response.error('error');
          }
        }
      }
      else
      {
        for (var i = 1; i <= count; i++) 
        {
          if (id == i)
          {
            array.push(userID.toString());
          }
          else
          {
            array.push('0');
          }
        }
        response.success(array);
      }

      AV.Cloud.run('sendSysNotice', {'groupID':groupID, 'message':array.join(','), 'type':111});
      return redisClient.setAsync('wolfKill:' + roomID, array.join(','));
    }).then(function(sss)
    {
      redisClient.decr(key, function(err, id){});
    }).catch(function(error)
    {
      console.log(error);
      redisClient.decr(key, function(err, id){});
      response.error('抢麦失败');
    });
  });
});

AV.Cloud.define('leaveWolfKillRoom', function(request, response)
{
  var roomID = request.params.roomID;
  var key = 'wolfSeat:' + roomID;
  var groupID = request.params.groupID;
  redisClient.incr('leaveWolfKillRoom:'+request.params.userID, function(err, id)
  {
    if (err || id > 1)
    {
      return response.error('正在处理了!');
    }
    redisClient.getAsync('wolfKill:'+roomID).then(function(cache)
    {
      var array = new Array();
      if (cache)
      {
        array = cache.split(',');
        for (var i = array.length - 1; i >= 0; i--) {
          if (array[i] == request.params.userID.toString())
          {
            array[i] = '0';
          }
        }
      }
       AV.Cloud.run('sendSysNotice', {'groupID':groupID, 'message':array.join(','), 'type':111});
      redisClient.setAsync('wolfKill:'+roomID, array.join(',')).then(function(ess)
      {
        //redisClient.decr(key, function(err, id){});
        redisClient.delAsync('leaveWolfKillRoom:'+request.params.userID);
        response.success(array);
      });
    });
  }); 
});

AV.Cloud.define('readyForWolfKill', function(request, response)
{
  var roomID = request.params.roomID;
  var seat = request.params.seat;
  var ready = request.params.ready;
  var groupID = request.params.groupID;
  var key = 'readyForWolfKill:'+roomID+"-" +seat;
  redisClient.incr(key, function(err, id)
  {
     if(err || id > 1)
     {
      response.error('稍等一会!');
     }
      AV.Cloud.run('sendSysNotice', {'groupID':groupID, 'message':seat+'-' + ready, 'type':112});
      redisClient.getAsync('wolfKillInfo:' + roomID).then(function(cache)
      {
        if(cache)
        {
          var data = JSON.parse(cache);
          var seats = data.seat.split('-');
          var has = false;
          for (var i = seats.length - 1; i >= 0; i--) 
          {
            var info = JSON.parse(seats[i]);
            if(info.seatNo = seat)
            {
              has = true;
              info.ready = ready;
            }
            seats[i] = JSON.stringify(info);
          }
          if (has == false)
          {
            var info = {seatNo:seat, 'ready':ready, state:0, role:-1};
            seats.push(info);
          }
          data['seat'] = seats.join('-');
          redisClient.setAsync('wolfKillInfo:' + roomID, JSON.stringify(data));
        }
      });
  });
});

AV.Cloud.define('startWolfKill', function(request, response)
{
  var roomID = request.params.roomID;
  var userID = request.params.userID;
  redisClient.incr('startWolfKill:'+roomID, function(err, id)
  {
    if (err || id > 1)
    {
      return response.error('已经开始游戏了, 请稍等!');
    }
    redisClient.expire('startWolfKill:'+roomID, 1);
    return new AV.Query('wolfKill').equalTo('roomID', roomID).first().then(function(data)
    {
      if (!data || data.get('userID') != userID)
      {
        return AV.Promise.error('房间已经被销毁了!');
      }
      var god = data.get('god').split(',');
      if (data.get('count') == 9)
      {
        for (var i = 0 ; i < 3; i++)
        {
          god.push('P');//平民
          god.push('L');//狼人
        }
      }
      //抽角色
      var role = new Array();
      while(god.length > 0)
      {
        var index = parseInt( Math.random() * 100 ) % god.length;
        role.push(god[index]);
        god.splice(index, 1);
      }
      data.set('role', role.join(','));
      data.set('step', 1);
      data.save();
      response.success(role);
    }).catch(function(error)
    {
      response.error(error);
    });
  });

});

module.exports = AV.Cloud;