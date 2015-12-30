function Handshake (parserStream) {
  var self = this;
  self.parserStream = parserStream;
}

Handshake.prototype.feed = function (chunk, encoding, cb) {
  var self = this;
  self.parserStream.buffer = Buffer.concat([
    self.parserStream.buffer,
    chunk
  ]);
  if (self.parserStream.buffer.length >= 68) {
    var handshake = self.parserStream.buffer.slice(0, 68);
    self.parserStream.buffer = self.parserStream.buffer.slice(68);
    self.parserStream.auditor.actions.send.handshake(handshake, function (err, decoded) {
      if (err) return cb(err);
      self.parserStream.emit('handshake', handshake, decoded);
      return cb(null);
    });
  } else {
    return cb(null);
  }
};

module.exports = Handshake;
