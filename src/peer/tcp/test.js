var net = require('net');
var definitions = require('./protocol/auditor/definitions');
var Peer = require('./index');

var server = net.createServer(function (socket) {
  var peer = new Peer(socket);
  peer.wire.peer.on('handshake', function (buffer) {
    console.log('\npeer handshake event!\n', buffer);
    peer.handshake({
      reserved: new Buffer(8),
      peer_id: new Buffer(20),
      info_hash: new Buffer(20)
    });
    peer.choke();
  });
  peer.wire.peer.on('message:choke', function (buffer) {
    console.log('\npeer choke event!\n', buffer);
  });
});
server.listen(9999);

// socket is the peer
var socket = new net.Socket();
socket.connect({
  port: 9999
}, function () {
  console.log('socket connected');
  socket.write(Buffer.concat([
    definitions.GLOBAL.pstrlen,
    definitions.GLOBAL.pstr,
    new Buffer(8),
    new Buffer(20),
    new Buffer(20)
  ]));
  socket.write(Buffer.concat([
    definitions.GLOBAL.message_length.choke,
    definitions.GLOBAL.message_id.choke
  ]));
});

socket.on('data', function (buffer) {
  console.log('peer has received data', buffer);
  console.log('peer data length', buffer.length);
});
