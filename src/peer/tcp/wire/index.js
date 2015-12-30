var stream = require('stream');
var util = require('util');

var protocol = require('./../protocol');

function Wire (opts) {
  var self = this;
  stream.Duplex.call(this);
  self.parser = new protocol.parser.Peer();
  self.outQueue = [];
  self.client = self.parser.client;
  self.peer = self.parser.peer;
  self.client.on('handshake', function (handshake) {
    self.push(handshake);
  });
  self.client.on('message', function (message) {
    self.push(message);
  });
}
util.inherits(Wire, stream.Duplex);

Wire.prototype._read = function (n) {
  var self = this;
  while (self.outQueue.length) {
    var chunk = self.outQueue.shift();
    if (!self.push(chunk)) {
      break;
    }
  }
};

Wire.prototype._write = function (chunk, encoding, cb) {
  var self = this;
  self.parser.peer.write(chunk, encoding);
  cb();
};

module.exports = Wire;

