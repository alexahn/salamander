var events = require('events');
var util = require('util');

var _ = require('underscore');
var async = require('async');
var Bitfield = require('bitfield');

function PeerConductor (opts, cb) {
  events.EventEmitter.call(self);
  var self = this;
  if (_.isFunction(opts)) {
    cb = opts;
    self.opts = {};
  } else {
    self.opts = opts;
  }
  self.peers = [];
  self.optimistic = 0;
  self.numInitialRequests = 16;
  self.clientRequestQueue = async.queue(function (task, cb) {
    self.emit('clientRequest', task, cb);
  }, 1);
  self.peerRequestQueue = async.queue(function (task, cb) {
    self.emit('peerRequest', task, cb);
  }, 1);
  self.peerHandlers.onError = _.bind(self.peerHandlers.onError, self);
  self.peerHandlers.onClientRequest = _.bind(self.peerHandlers.onClientRequest, self);
  self.peerHandlers.onPeerRequest = _.bind(self.peerHandlers.onPeerRequest, self);

  self.peerHandlers.onPeerMessagePiece = _.bind(self.peerHandlers.onPeerMessagePiece, self);
  self.peerHandlers.onPeerMessageRequest = _.bind(self.peerHandlers.onPeerMessageRequest, self);
  self.peerHandlers.onPeerMessageHave = _.bind(self.peerHandlers.onPeerMessageHave, self);
  self.peerHandlers.onPeerMessageBitfield = _.bind(self.peerHandlers.onPeerMessageBitfield, self);

  self.peerHandlers.onClientMessageHave = _.bind(self.peerHandlers.onClientMessageHave, self);
  self.peerHandlers.onClientMessageBitfield = _.bind(self.peerHandlers.onClientMessageBitfield, self);

  self.init(cb);
}
util.inherits(PeerConductor, events.EventEmitter);

PeerConductor.prototype.init = function (cb) {
  var self = this;
  self.interval = setInterval(function () {
    var unchokedInterested = self.pieceConductor.complete ? 32 : 4;
    var sortedBy = self.pieceConductor.complete ? 'peer' : 'client';
    self.optimistic += 1;
    self.optimistic = self.optimistic % 3;
    if (!self.optimistic % 3) {
      // do optimistic unchoking
      // if the peer is interested, then it counts as one of the download slots
      var optimisticPeer = _.sample(self.peers);
      if (optimisticPeer) {
        if (optimisticPeer.state.peer.interested) {
          unchokedInterested -= 1;
        }
        optimisticPeer.unchoke();
      }
    }
    self.peers = _.sortBy(self.peers, function (peer) {
      return peer.state[sortedBy].downloaded;
    });
    var interested = _.filter(self.peers, function (peer) {
      return peer.state.peer.interested;
    });
    _.each(_.range(unchokedInterested), function (index) {
      if (index < interested.length) {
        interested[index].unchoke();
      }
    });

    var lowerLimit = interested.length < unchokedInterested ? _.last(interested) : interested[unchokedInterested - 1];
    if (lowerLimit) {
      var uninterested = _.filter(self.peers, function (peer) {
        return (!peer.state.peer.interested && peer.state[sortedBy].downloaded > lowerLimit.state[sortedBy].downloaded);
      });
      _.each(uninterested, function (peer) {
        peer.unchoke();
      });
    }

  }, 10000);
  return cb(null, self);
};


PeerConductor.prototype.handshake = function (peer) {
  var self = this;
  peer.handshake({
    peer_id: self.opts.peer_id,
    reserved: self.opts.reserved,
    info_hash: self.opts.info_hash
  });
};

PeerConductor.prototype.bitfield = function (peer) {
  var self = this;
  if (_.some(self.pieceConductor.verified)) {
    var bitfield = new Bitfield(self.pieceConductor.opts.numPieces);
    _.each(self.pieceConductor.verified, function (v, index) {
      bitfield.set(index, v);
    });
    var message_length = new Buffer(4);
    message_length.writeUInt32BE(bitfield.buffer.length + 1, 0);
    peer.bitfield({
      message_length: message_length,
      bitfield: bitfield.buffer
    });
  }
};

PeerConductor.prototype.checkInterested = function (peer) {
  var self = this;
  var interestedPieces = _.map(self.pieceConductor.verified, function (v, index) {
    return !v && peer.state.peer.bitfield.get(index);
  });
  var numInterestedPieces = _.reduce(interestedPieces, function (memo, v) {
    return memo + Number(v);
  }, 0);
  return numInterestedPieces;
};

PeerConductor.prototype.peerHandlers = {};
PeerConductor.prototype.peerHandlers.onError = function (peer) {
  var self = this;
  return function (err) {
    return self.emit('peerError', err, peer);
  };
};
PeerConductor.prototype.peerHandlers.onClientRequest = function (peer) {
  var self = this;
  return function (task, callback) {
    task.peers = self.peers;
    return self.clientRequestQueue.push(task, callback);
  };
};
PeerConductor.prototype.peerHandlers.onPeerRequest = function (peer) {
  var self = this;
  return function (task, callback) {
    task.peers = self.peers;
    return self.peerRequestQueue.push(task, callback);
  };
};
PeerConductor.prototype.peerHandlers.onClientMessageBitfield = function (peer) {
  var self = this;
  return function (message, decoded) {
    if (!self.checkInterested(peer) && peer.state.client.interested) {
      peer.not_interested();
    }
    self.pieceConductor.calculatePieceCounts(self.peers);
  };
};
PeerConductor.prototype.peerHandlers.onClientMessageHave = function (peer) {
  var self = this;
  return function (message, decoded) {
    if (!self.checkInterested(peer) && peer.state.client.interested) {
      peer.not_interested();
    }
    self.pieceConductor.calculatePieceCounts(self.peers);
  };
};
PeerConductor.prototype.peerHandlers.onPeerMessageRequest = function (peer) {
  var self = this;
  return function (message, decoded) {
    peer.queuePeerRequest(decoded);
  };
};
PeerConductor.prototype.peerHandlers.onPeerMessagePiece = function (peer) {
  var self = this;
  return function (message, decoded) {
    self.pieceConductor.processPeerPiece(decoded, function (err) {
      if (err) return self.emit('error', err);
    });
    // should we move this into the callback?
    peer.queueClientRequest();
  };
};
PeerConductor.prototype.peerHandlers.onPeerMessageBitfield = function (peer) {
  var self = this;
  return function (message, decoded) {
    if (self.checkInterested(peer) && !peer.state.client.interested) {
      peer.state.client.interested = true;
      peer.interested();
      // send out 16 requests
      _.each(_.range(self.numInitialRequests), function () {
        peer.queueClientRequest();
      });
    }
  };
};
PeerConductor.prototype.peerHandlers.onPeerMessageHave = function (peer) {
  var self = this;
  return function (message, decoded) {
    // check to see if we should be interested
    // use fileConductor
    if (self.checkInterested(peer) && !peer.state.client.interested) {
      peer.state.client.interested = true;
      peer.interested();
      // this should be smart, and we should send out requests up to the limit or initial 16
    }
  };
};

PeerConductor.prototype.addPeer = function (peer, cb) {
  var self = this;
  self.peers.push(peer);
  self.clientRequestQueue.concurrency = self.peers.length;
  self.peerRequestQueue.concurrency = self.peers.length;
  // attach handlers here
  peer.onError = self.peerHandlers.onError(peer);
  peer.onClientRequest = self.peerHandlers.onClientRequest(peer);
  peer.onPeerRequest = self.peerHandlers.onPeerRequest(peer);

  peer.onPeerMessagePiece = self.peerHandlers.onPeerMessagePiece(peer);
  peer.onPeerMessageRequest = self.peerHandlers.onPeerMessageRequest(peer);
  peer.onPeerMessageBitfield = self.peerHandlers.onPeerMessageBitfield(peer);
  peer.onPeerMessageHave = self.peerHandlers.onPeerMessageHave(peer);

  peer.onClientMessageBitfield = self.peerHandlers.onClientMessageBitfield(peer);
  peer.onClientMessageHave = self.peerHandlers.onClientMessageHave(peer);

  peer.on('error', peer.onError);
  peer.on('clientRequest', peer.onClientRequest);
  peer.on('peerRequest', peer.onPeerRequest);

  peer.wire.peer.on('message:piece', peer.onPeerMessagePiece);
  peer.wire.peer.on('message:request', peer.onPeerMessageRequest);
  peer.wire.peer.on('message:bitfield', peer.onPeerMessageBitfield);
  peer.wire.peer.on('message:have', peer.onPeerMessageHave);

  peer.wire.client.on('message:bitfield', peer.onClientMessageBitfield);
  peer.wire.client.on('message:have', peer.onClientMessageHave);

  self.handshake(peer);
  self.bitfield(peer);
  self.emit('addPeer', peer);
  return cb(null, peer);
};

PeerConductor.prototype.removePeer = function (peer, cb) {
  var self = this;
  if (!_.contains(self.peers, peer)) return cb(new Error('Peer not found in list'));
  peer.removeListener('error', peer.onError);
  peer.removeListener('clientRequest', peer.onClientRequest);
  peer.removeListener('peerRequest', peer.onPeerRequest);
  peer.wire.peer.removeListener('message:piece', peer.onPeerMessagePiece);
  peer.wire.peer.removeListener('message:request', peer.onPeerMessageRequest);
  peer.wire.peer.removeListener('message:bitfield', peer.onPeerMessageBitfield);
  peer.wire.peer.removeListener('message:have', peer.onPeerMessageHave);
  peer.wire.client.removeListener('message:bitfield', peer.onClientMessageBitfield);
  peer.wire.client.removeListener('message:have', peer.onClientMessageHave);
  self.clientRequestQueue.concurrency = self.peers.length;
  self.peerRequestQueue.concurrency = self.peers.length;
  self.peers = _.without(self.peers, peer);
  self.emit('removePeer', peer);
  return cb(null, peer);
};

PeerConductor.prototype.registerFileConductor = function (fileConductor, cb) {
  var self = this;
  self.fileConductor = fileConductor;
  return cb(null);
};

PeerConductor.prototype.registerPieceConductor = function (pieceConductor, cb) {
  var self = this;
  self.pieceConductor = pieceConductor;
  self.onPieceComplete = function (index) {
    _.each(self.peers, function (peer) {
      var piece_index = new Buffer(4);
      piece_index.writeUInt32BE(index, 0);
      peer.have({
        piece_index: piece_index
      });
    });
  };
  self.pieceConductor.on('pieceComplete', self.onPieceComplete);
  return cb(null);
};

PeerConductor.prototype.unregisterPieceConductor = function (pieceConductor, cb) {
  var self = this;
  if (self.pieceConductor === pieceConductor) {
    self.pieceConductor.removeListener('pieceComplete', self.onPieceComplete);
    self.pieceConductor = null;
  }
  return cb(null);
};

module.exports = PeerConductor;
