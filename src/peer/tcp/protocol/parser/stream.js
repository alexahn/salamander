var util = require('util');
var stream = require('stream');
var parsers = require('./parsers');
var auditor = require('./../auditor');

var StateMachine = require('javascript-state-machine');

function ParserStream () {
  var self = this;
  self.buffer = new Buffer(0);
  self.parsers = {
    handshake: new parsers.Handshake(self),
    message: new parsers.Message(self)
  };
  self.auditor = new auditor.Peer();
  self.handshake = StateMachine.create({
    initial: 'none',
    events: [{
      name: 'sent',
      from: 'none',
      to: 'sent'
    }]
  });
  self.parser = StateMachine.create({
    initial: 'handshake',
    error: function (eventName, from, to, errorCode, errorMessage) {
      self.emit('error', new Error([eventName, errorMessage].join(' ')));
    },
    events: [{
      name: 'message',
      from: 'handshake',
      to: 'message'
    }]
  });
  stream.Writable.call(self);
}

util.inherits(ParserStream, stream.Writable);

ParserStream.prototype._write = function (chunk, encoding, cb) {
  var self = this;
  self.parsers[self.parser.current].feed(chunk, encoding, cb);
};

module.exports = ParserStream;
