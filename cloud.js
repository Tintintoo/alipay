var AV = require('leanengine');

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function(request, response) {
  response.success('Hello world!');
});
AV.Cloud.define('payCheckOne’, function(request, response) {
AV.Cloud.httpRequest({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  url: request.params.url,
  body: request.params.receiptdata,
  success: function(httpResponse) {
    console.log('Request succ ' + httpResponse.text);
    response.success(httpResponse.text);
  },
  error: function(httpResponse) {
    console.error('Request failed with response code ' + httpResponse.status);
  }
});
});
module.exports = AV.Cloud;
