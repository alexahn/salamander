var Auditor = require('./index');
var definitions = require('./definitions');

var client = new Auditor.Client();

var buffer = Buffer.concat([
  definitions.GLOBAL.DEFAULT_CONNECTION_ID,
  definitions.GLOBAL.action.connect,
  new Buffer(4)
]);

console.log(buffer);

client.actions.send.connect(buffer, function (err) {
  if (err) throw err;
  console.log('done client');
});

var server = new Auditor.Server();

var buffer2 = Buffer.concat([
  definitions.GLOBAL.action.connect,
  definitions.GLOBAL.DEFAULT_CONNECTION_ID,
  new Buffer(4)
]);

server.actions.send.connect(buffer2, function (err) {
  if (err) throw err;
  console.log('done server');
});
