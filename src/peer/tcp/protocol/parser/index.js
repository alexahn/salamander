var ParserStream = require('./stream');
var definitions = require('./../auditor/definitions');

// this class ultimately needs to be able to emit events that have legitimate protocol payloads
// should already take care of using the network protocol and verifying the structure of payloads
// Parser itself needs to be an event emitter (?)
function Parser () {
  var self = this;
  self.client = new ParserStream();
  self.peer = new ParserStream();
  self.client.peer = self.peer;
  self.peer.peer = self.client;
  self.definitions = definitions;
  self.client.on('handshake', function () {
    self.client.handshake.sent();
    self.changeParsers();
  });
  self.peer.on('handshake', function () {
    self.peer.handshake.sent();
    self.changeParsers();
  });
}

Parser.prototype.changeParsers = function () {
  var self = this;
  var peerSent = self.peer.handshake.current === 'sent';
  var clientSent = self.client.handshake.current === 'sent';
  if (peerSent && clientSent) {
    self.peer.parser.message();
    self.client.parser.message();
    // hacky way to get around the parsing stop error (might need to change this later)
    // the source of the hassle is that we need to feed to trigger the processing logic
    self.peer.parsers[self.peer.parser.current].feed(new Buffer(0), 'utf8', function (err) {
      if (err) {
        self.peer.emit('error', err);
      }
    });
    self.client.parsers[self.client.parser.current].feed(new Buffer(0), 'utf8', function (err) {
      if (err) {
        self.client.emit('error', err);
      }
    });
  }
};

module.exports = {
  Peer: Parser
};
