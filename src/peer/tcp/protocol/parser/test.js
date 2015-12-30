var Parser = require('./index').Peer;
var definitions = require('./../auditor/definitions');

var parser = new Parser();

parser.client.on('handshake', function (buffer) {
  console.log('handshake event!', buffer);
});

parser.client.on('message:choke', function (buffer) {
  console.log('choke event!', buffer);
});

parser.client.on('message:unchoke', function (buffer) {
  console.log('unchoke event!', buffer);
});

parser.client.on('message:interested', function (buffer) {
  console.log('interested event!', buffer);
});

parser.client.write(Buffer.concat([
  definitions.GLOBAL.pstrlen,
  definitions.GLOBAL.pstr,
  new Buffer(8),
  new Buffer(20),
  new Buffer(20),
  definitions.GLOBAL.message.choke,
  definitions.GLOBAL.message.unchoke
]));

parser.peer.write(Buffer.concat([
  definitions.GLOBAL.pstrlen,
  definitions.GLOBAL.pstr,
  new Buffer(8),
  new Buffer(20),
  new Buffer(20)
]));

parser.client.write(definitions.GLOBAL.message.interested);

// currently, we have a minor problem, in that if the peer sends us a handshake and a series of messages really fast,
// then the handshake will get parsed, but the messages will stay in a buffer and will only get parsed when we received
// the next message from the peer
