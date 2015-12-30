var Wire = require('./index');
var stream = require('stream');
var util = require('util');
var definitions = require('./../protocol/auditor/definitions');

var wire = new Wire();

function Readable () {
  var self = this;
  stream.Readable.call(self);
  self.outQueue = [];
  var empty8 = new Buffer(8);
  var empty20 = new Buffer(20);
  empty8.fill(97);
  empty20.fill(97);
  self.outQueue.push(Buffer.concat([
    definitions.GLOBAL.pstrlen,
    definitions.GLOBAL.pstr,
    empty8,
    empty20,
    empty20
  ]));
}

util.inherits(Readable, stream.Readable);

Readable.prototype._read = function (n) {
  var self = this;
  while (self.outQueue.length) {
    var chunk = self.outQueue.shift();
    if (!self.push(chunk)) {
      break;
    }
  }
};

var peerInput = new Readable();

var clientInput = new Readable();

wire.peer.on('handshake', function (buffer) {
  console.log('peer:handshake event!', buffer);
});

wire.client.on('handshake', function (buffer) {
  console.log('client:handshake event!', buffer);
});

clientInput.pipe(wire.client);
peerInput.pipe(wire);
wire.pipe(process.stdout);
