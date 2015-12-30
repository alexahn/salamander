var util = require('util');
var events = require('events');

var uuid = require('uuid');
var async = require('async');

var Wire = require('./wire');
var protocol = require('./protocol');
var translator = protocol.translator;
var definitions = require('./protocol/auditor/definitions');

var Bitfield = require('bitfield');

function Peer (socket, opts) {
  var self = this;
  events.EventEmitter.call(self);
  self.connectionId = uuid.v4();
  self.wire = new Wire();
  socket.pipe(self.wire).pipe(socket);
  socket.on('error', function (err) {
    //console.log('some fucking crazy socket error', err);
    err.source = 'socket';
    self.emit('error', err);
  });
  self.translator = new translator.Peer();

  opts = opts ? opts : {};
  self.maxPieces = opts.maxPieces ? opts.maxPieces : 524288;

  // keep track of state information for peer
  self.state = {};

  self.state.peer = {};
  self.state.peer.handshake = false;
  self.state.peer.choking = true;
  self.state.peer.interested = false;
  self.state.peer.requested = [];
  self.state.peer.bitfield = new Bitfield(0, {
    grow: self.maxPieces
  }); // this should really be a bitfield
  self.state.peer.downloaded = 0;
  
  self.state.client = {};
  self.state.client.handshake = false;
  self.state.client.choking = true;
  self.state.client.interested = false;
  self.state.client.requested = [];
  self.state.client.downloaded = 0;

  self.state.client.uploaded = self.state.peer.downloaded;
  self.state.peer.uploaded = self.state.client.downloaded;

  self.clientRequestQueue = async.queue(function (task, cb) {
    self.emit('clientRequest', task, cb);
  }, 1);
  self.peerRequestQueue = async.queue(function (task, cb) {
    self.emit('peerRequest', task, cb);
  }, 1);
  self.clientRequestQueue.pause();
  self.peerRequestQueue.pause();

  self.wire.client.on('error', function (err) {
    //console.log('\n CLIENT ERROR \n', err);
    err.source = 'client';
    self.emit('error', err);
  });
  self.wire.client.on('handshake', function () {
    self.state.client.handshake = true;
  });
  self.wire.client.on('message:choke', function () {
    self.state.client.choking = true;
    self.peerRequestQueue.pause();
  });
  self.wire.client.on('message:unchoke', function () {
    self.state.client.choking = false;
    if (self.state.peer.interested) {
      self.peerRequestQueue.resume();
    }
  });
  self.wire.client.on('message:interested', function () {
    self.state.client.interested = true;
    if (!self.state.peer.choking) {
      self.clientRequestQueue.resume();
    }
  });
  self.wire.client.on('message:not_interested', function () {
    self.state.client.interested = false;
    self.clientRequestQueue.pause();
  });
  self.wire.client.on('message:have', function () {
  });
  self.wire.client.on('message:bitfield', function () {
  });
  self.wire.client.on('message:request', function () {
  });
  self.wire.client.on('message:piece', function (buffer, decoded) {
    var size = decoded.block.length;
    self.state.peer.downloaded += size;
  });
  self.wire.client.on('message:cancel', function () {
  });
  self.wire.client.on('message:port', function () {
  });

  self.wire.peer.on('error', function (err) {
    //console.log('\n PEER ERROR \n', err);
    err.source = 'peer';
    self.emit('error', err);
  });
  self.wire.peer.on('handshake', function (buffer, decoded) { 
    self.state.peer.handshake = true;
  });
  self.wire.peer.on('message:choke', function (buffer, decoded) { 
    self.state.peer.choking = true;
    self.clientRequestQueue.pause();
  });
  self.wire.peer.on('message:unchoke', function (buffer, decoded) { 
    self.state.peer.choking = false;
    if (self.state.client.interested) {
      self.clientRequestQueue.resume();
    }
  });
  self.wire.peer.on('message:interested', function (buffer, decoded) {
    self.state.peer.interested = true;
    if (!self.state.client.choking) {
      self.peerRequestQueue.resume();
    }
  });
  self.wire.peer.on('message:not_interested', function (buffer, decoded) { 
    self.state.peer.interested = false;
    self.peerRequestQueue.pause();
  });
  self.wire.peer.on('message:have', function (buffer, decoded) {
    // flip bit on self.state.peer.pieces
    self.state.peer.bitfield.set(decoded.piece_index.readUInt32BE(0), true);
  });
  self.wire.peer.on('message:bitfield', function (buffer, decoded) { 
    // set self.state.peer.pieces
    self.state.peer.bitfield = new Bitfield(decoded.bitfield, {
      grow: self.maxPieces
    });
  });
  self.wire.peer.on('message:request', function (buffer, decoded) {
    // if we have this piece, add to queue
  });
  self.wire.peer.on('message:piece', function (buffer, decoded) {
    var size = decoded.block.length;
    self.state.client.downloaded += size;
  });
  self.wire.peer.on('message:cancel', function (buffer, decoded) {
  });
  self.wire.peer.on('message:port', function (buffer, decoded) {
  });

}

util.inherits(Peer, events.EventEmitter);

Peer.prototype.queueClientRequest = function () {
  var self = this;
  self.clientRequestQueue.push({
    peer: self
  });
};

Peer.prototype.queuePeerRequest = function (decoded) {
  var self = this;
  self.peerRequestQueue.push({
    peer: self,
    decoded: decoded
  });
};

Peer.prototype.handshake = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.pstrlen = definitions.GLOBAL.pstrlen;
  opts.pstr = definitions.GLOBAL.pstr;
  self._handshake(opts);
};

Peer.prototype._handshake = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.handshake.encode(opts);
  self.wire.client.write(payload);
};

Peer.prototype.choke = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.message_length = definitions.GLOBAL.message_length.choke;
  opts.message_id = definitions.GLOBAL.message_id.choke;
  self._choke(opts);
};

Peer.prototype._choke = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.message.choke.encode(opts);
  self.wire.client.write(payload);
};

Peer.prototype.unchoke = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.message_length = definitions.GLOBAL.message_length.unchoke;
  opts.message_id = definitions.GLOBAL.message_id.unchoke;
  self._unchoke(opts);
};

Peer.prototype._unchoke = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.message.unchoke.encode(opts);
  self.wire.client.write(payload);
};

Peer.prototype.interested = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.message_length = definitions.GLOBAL.message_length.interested;
  opts.message_id = definitions.GLOBAL.message_id.interested;
  self._interested(opts);
};

Peer.prototype._interested = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.message.interested.encode(opts);
  self.wire.client.write(payload);
};

Peer.prototype.not_interested = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.message_length = definitions.GLOBAL.message_length.not_interested;
  opts.message_id = definitions.GLOBAL.message_id.not_interested;
  self._not_interested(opts);
};

Peer.prototype._not_interested = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.message.not_interested.encode(opts);
  self.wire.client.write(payload);
};

Peer.prototype.have = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.message_length = definitions.GLOBAL.message_length.have;
  opts.message_id = definitions.GLOBAL.message_id.have;
  self._have(opts);
};

Peer.prototype._have = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.message.have.encode(opts);
  self.wire.client.write(payload);
};

Peer.prototype.bitfield = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.message_id = definitions.GLOBAL.message_id.bitfield;
  self._bitfield(opts);
};

Peer.prototype._bitfield = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.message.bitfield.encode(opts);
  self.wire.client.write(payload);
};

Peer.prototype.request = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.message_length = definitions.GLOBAL.message_length.request;
  opts.message_id = definitions.GLOBAL.message_id.request;
  self._request(opts);
};

Peer.prototype._request = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.message.request.encode(opts);
  self.wire.client.write(payload);
};

Peer.prototype.piece = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.message_id = definitions.GLOBAL.message_id.piece;
  self._piece(opts);
};

Peer.prototype._piece = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.message.piece.encode(opts);
  self.wire.client.write(payload);
};

Peer.prototype.cancel = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.message_length = definitions.GLOBAL.message_length.cancel;
  opts.message_id = definitions.GLOBAL.message_id.cancel;
  self._cancel(opts);
};

Peer.prototype._cancel = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.message.cancel.encode(opts);
  self.wire.client.write(payload);
};

Peer.prototype.port = function (opts) {
  var self = this;
  opts = opts ? opts : {};
  opts.message_length = definitions.GLOBAL.message_length.port;
  opts.message_id = definitions.GLOBAL.message_id.port;
  self._port(opts);
};

Peer.prototype._port = function (opts) {
  var self = this;
  var payload = self.translator.actions.send.message.port.encode(opts);
  self.wire.client.write(payload);
};

module.exports = Peer;
