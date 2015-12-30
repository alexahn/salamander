var async = require('async');

function Message (parserStream) {
  var self = this;
  self.parserStream = parserStream;
}

Message.prototype.feed = function (chunk, encoding, cb) {
  var self = this;
  var queue = async.queue(function (message, callback) {
    self.classifyMessage(message, callback);
  }, 1);
  queue.drain = function () {
    queue.kill();
    return cb(null);
  };
  self.parserStream.buffer = Buffer.concat([
    self.parserStream.buffer,
    chunk
  ]);
  // fast check here to ensure that self.parserStream.buffer contains a valid message (future)
  while (self.parserStream.buffer.length >= 4) {
    if (self.parserStream.buffer.length < 4) break;
    var messageSize = self.parserStream.buffer.readUInt32BE(0);
    if (messageSize + 4 > self.parserStream.buffer.length) break;
    // limit maximum messageSize here (future)
    var message = self.parserStream.buffer.slice(0, messageSize + 4);
    self.parserStream.buffer = self.parserStream.buffer.slice(messageSize + 4);
    queue.push(message, function (err) {
      if (err) {
        queue.kill();
        return cb(err);
      }
    });
  }
  if (!queue.started) {
    return cb(null);
  }
};

Message.prototype.classifyMessage = function (message, cb) {
  var self = this;
  var message_length = message.readUInt32BE(0);
  var message_id;
  if (message_length === 0) {
    self.parserStream.auditor.actions.send.message.keep_alive(message, function (err, decoded) {
      if (err) return cb(err);
      // refer to state to ensure this is a valid action
      self.parserStream.emit('message', message, decoded);
      self.parserStream.emit('message:keep_alive', message, decoded);
      return cb(null);
    });
  } else {
    message_id = message.slice(4, 5);
    message_id = message_id.readUInt8(0);
    switch (message_id) {
      case 0:
        self.parserStream.auditor.actions.send.message.choke(message, function (err, decoded) {
          if (err) return cb(err);
          // refer to state to ensure this is a valid option
          // remember we can access self.parserStream.peer to get the state of the peer
          self.parserStream.emit('message', message, decoded);
          self.parserStream.emit('message:choke', message, decoded);
          return cb(null);
        });
        break;
      case 1:
        self.parserStream.auditor.actions.send.message.unchoke(message, function (err, decoded) {
          if (err) return cb(err);
          self.parserStream.emit('message', message, decoded);
          self.parserStream.emit('message:unchoke', message, decoded);
          return cb(null);
        });
        break;
      case 2:
        self.parserStream.auditor.actions.send.message.interested(message, function (err, decoded) {
          if (err) return cb(err);
          self.parserStream.emit('message', message, decoded);
          self.parserStream.emit('message:interested', message, decoded);
          return cb(null);
        });
        break;
      case 3:
        self.parserStream.auditor.actions.send.message.not_interested(message, function (err, decoded) {
          if (err) return cb(err);
          self.parserStream.emit('message', message, decoded);
          self.parserStream.emit('message:not_interested', message, decoded);
          return cb(null);
        });
        break;
      case 4:
        self.parserStream.auditor.actions.send.message.have(message, function (err, decoded) {
          if (err) return cb(err);
          self.parserStream.emit('message', message, decoded);
          self.parserStream.emit('message:have', message, decoded);
          return cb(null);
        });
        break;
      case 5:
        self.parserStream.auditor.actions.send.message.bitfield(message, function (err, decoded) {
          if (err) return cb(err);
          self.parserStream.emit('message', message, decoded);
          self.parserStream.emit('message:bitfield', message, decoded);
          return cb(null);
        });
        break;
      case 6:
        self.parserStream.auditor.actions.send.message.request(message, function (err, decoded) {
          if (err) return cb(err);
          self.parserStream.emit('message', message, decoded);
          self.parserStream.emit('message:request', message, decoded);
          return cb(null);
        });
        break;
      case 7:
        self.parserStream.auditor.actions.send.message.piece(message, function (err, decoded) {
          if (err) return cb(err);
          self.parserStream.emit('message', message, decoded);
          self.parserStream.emit('message:piece', message, decoded);
          return cb(null);
        });
        break;
      case 8:
        self.parserStream.auditor.actions.send.message.cancel(message, function (err, decoded) {
          if (err) return cb(err);
          self.parserStream.emit('message', message, decoded);
          self.parserStream.emit('message:cancel', message, decoded);
          return cb(null);
        });
        break;
      case 9:
        self.parserStream.auditor.actions.send.message.port(message, function (err, decoded) {
          if (err) return cb(err);
          self.parserStream.emit('message', message, decoded);
          self.parserStream.emit('message:port', message, decoded);
          return cb(null);
        });
        break;
      default:
        // error here
        return cb(new Error('invalid message id: ' + message_id));
    }
  }
};

module.exports = Message;
