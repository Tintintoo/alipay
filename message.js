var AV = require('leanengine');
var Realtime = require('leancloud-realtime').Realtime;
var TextMessage = require('leancloud-realtime').TextMessage;
var realtime = new Realtime({
  appId: 'ifmmzg0hwfo69zdho7dwwjlakqupnmjuukcab6pothxs50i0',
  region: 'cn', // 美国节点为 "us"
});


realtime.createIMClient('-1').then(function(tom)
{
	tom.on('message', function(message, conversation)
	{
		console.log(message.from+","+message.cid+","+message.id+","+message.timestamp+","+ message.deliveredAt);
    	console.log('Message received: ' + message.text);
    	return tom.createConversation({members: [message.from.toString()],
   	 									name: 'system',unique: true}).then(function(conversation)
 		{	
 			return conversation.send(new TextMessage(JSON.stringify({'msg':'那我们出去玩吧！','type' :'text','msgtype':0})));
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

AV.Cloud.define('sendNotice', function(request, response)
{
	realtime.createIMClient('-1').then(function(tom)
	{
		return tom.getConversation('57d11cefbf22ec005f95feee');
	}).then(function(conversation)
	{
		return conversation.send(new TextMessage(JSON.stringify({'msg':request.params.message,'type' :'text','msgtype':1})));
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

module.exports = AV.Cloud;