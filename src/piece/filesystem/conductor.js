var events = require('events');
var util = require('util');
var crypto = require('crypto');

var _ = require('underscore');
var async = require('async');
var bufferEqual = require('buffer-equal');

var Piece = require('./piece');

function PieceConductor (opts, cb) {
  var self = this;
  events.EventEmitter.call(self);
  if (_.isFunction(opts)) {
    cb = opts;
    self.opts = {};
  } else {
    self.opts = opts;
  }
  self.pieces = [];
  self.verified = [];
  self.complete = false;
  if (!opts.pieceLength) throw new Error('piece length unspecified');
  if (!opts.numPieces) throw new Error('num pieces unspecified');
  self.pieceLength = opts.pieceLength;
  self.numPieces = opts.numPieces;
  self.blockLength = opts.blockLength;
  self.numBlocks = Math.ceil(self.pieceLength / self.blockLength);
  // set initial pieces randomly?
  self.pieceMax = 64;
  // this needs to be cleaned up so that the pieceLength is actually correct
  self.cursors = {};
  self.onPieceComplete = _.bind(self.onPieceComplete, self);
  self.onPieceBlocksComplete = _.bind(self.onPieceBlocksComplete, self);
  return self.init(cb);
}
util.inherits(PieceConductor, events.EventEmitter);

PieceConductor.prototype.verify = function (cb) {
  var self = this;
  async.mapSeries(_.range(self.opts.numPieces), function (index, cb) {
    self.verifyPiece(index, self.getPieceLength(index), cb);
  }, function (err, results) {
    if (err) return cb(err);
    self.verified = results;
    return cb(null, results);
  });
};

PieceConductor.prototype.verifyPiece = function (pieceIndex, pieceLength, cb) {
  var self = this;
  self.fileConductor.read(pieceIndex, 0, pieceLength, function (err, buffer) {
    if (err) return cb(err);
    var sha = crypto.createHash('sha1').update(buffer).digest('hex');
    var shaBuffer = new Buffer(sha, 'hex');
    var pieceBuffer = self.opts.pieceHashes.slice(pieceIndex * 20, (pieceIndex + 1) * 20);
    var equal = bufferEqual(shaBuffer, pieceBuffer);
    if (equal) {
      self.verified[pieceIndex] = true;
    }
    if (self.piecesCompleted()) {
      self.complete = true;
      self.emit('complete');
    }
    return cb(null, equal);
  });
};

PieceConductor.prototype.init = function (cb) {
  var self = this;
  _.each(_.range(self.numPieces), function () {
    self.verified.push(false);
  });
  return cb(null, self);
};

PieceConductor.prototype.getPiece = function (index) {
  var self = this;
  var found = _.find(self.pieces, function (p) {
    return p.index === index;
  });
  return found;
};

PieceConductor.prototype.getOrCreatePiece = function (index, cb) {
  var self = this;
  var found = self.getPiece(index);
  if (found) {
    return cb(null, found);
  } else {
    if (self.verified[index]) throw new Error('trying to create a piece that has been verified');
    return new Piece({
      index: index,
      pieceLength: self.getPieceLength(index),
      blockLength: self.blockLength
    }, function (err, piece) {
      if (err) return cb(err);
      return self.addPiece(piece, cb);
    });
  }
};

PieceConductor.prototype.getPieceLength = function (index) {
  var self = this;
  var totalBytes = self.fileConductor.totalBytes();
  var startByte = index * self.pieceLength;
  var endByte = (index + 1) * self.pieceLength;
  var pieceLength = self.pieceLength;
  if (endByte > totalBytes) {
    pieceLength = totalBytes - startByte;
  }
  return pieceLength;
};

PieceConductor.prototype.piecesCompleted = function () {
  var self = this;
  return _.some(self.verified) && _.every(self.verified);
};

PieceConductor.prototype.processPeerPiece = function (decoded, cb) {
  var self = this;
  self.emit('processPeerPiece', decoded);
  var piece_index = decoded.piece_index.readUInt32BE(0);
  var piece_begin = decoded.piece_begin.readUInt32BE(0);
  var piece_block = decoded.block;
  var piece = self.getPiece(piece_index);
  if (!piece || piece.blocksComplete || piece.completed) return cb(null);
  var block_index = piece_begin / piece.opts.blockLength;
  self.fileConductor.write(piece_index, piece_begin, piece_block, function (err, buffer) {
    if (err) return cb(err);
    if (bufferEqual(buffer, piece_block)) {
      piece.setBlock(block_index);
    } else {
      console.log('we got fucking issues with buffers', piece_block.length, buffer.length);
    }
  });
};

PieceConductor.prototype.processPeerRequest = function (decoded, cb) {
  var self = this;
  self.emit('processPeerRequest', decoded);
  var piece_index = decoded.piece_index.readUInt32BE(0);
  var piece_begin = decoded.piece_begin.readUInt32BE(0);
  var block_length = decoded.block_length.readUInt32BE(0);
  self.fileConductor.read(piece_index, piece_begin, block_length, cb);
};

PieceConductor.prototype.numInterestedPiecesForPeer = function (peer) {
  var self = this;
  var intersection = _.map(self.verified, function (v, index) {
    return !v && peer.state.peer.bitfield.get(index);
  });
  return _.reduce(intersection, function (memo, v) {
    return memo + Number(v);
  }, 0);
};

PieceConductor.prototype.numInterestedBlocksForPeer = function (peer) {
  var self = this;
  // an upper limit that is not exact
  return self.numInterestedPiecesForPeer * self.numBlocks;
};

PieceConductor.prototype.processClientRequest = function (peer, peers, cb) {
  var self = this;
  self.emit('processClientRequest', peer);
  if (!self.cursors[peer.connectionId]) {
    // select a new random unfinished piece
    var mapped = _.map(self.verified, function (v, index) {
      return {
        verified: v,
        available: peer.state.peer.bitfield.get(index),
        index: index
      };
    });
    var filtered = _.filter(mapped, function (m) {
      return !m.verified && m.available;
    });
    var random = _.sample(filtered);
    if (!random) return cb(null, null);
    self.getOrCreatePiece(random.index, function (err, piece) {
      if (err) return cb(err);
      var piece = self.getPiece(random.index);
      var blocks = _.filter(piece.blocks, function (b) {
        return !b.received;
      });
      var block = _.first(blocks);
      if (!block) return setImmediate(function () {
        console.log('block not fucking found', piece);
        self.processClientRequest(peer, peers, cb);
      });
      self.cursors[peer.connectionId] = {
        piece: piece,
        block: block
      };
      return cb(null, {
        offset: self.getOffsetLength(piece, block)
      });
    });
  } else {
    var piece = self.cursors[peer.connectionId].piece;
    var lastBlock = self.cursors[peer.connectionId].block;
    var blocks = _.filter(piece.blocks, function (b) {
      return !b.received && b.index > lastBlock.index;
    });
    var block = _.first(blocks);
    if (!block) {
      self.cursors[peer.connectionId] = null; 
      return setImmediate(function () {
        self.processClientRequest(peer, peers, cb);
      });
    }
    self.cursors[peer.connectionId] = {
      piece: piece,
      block: block
    };
    return cb(null, {
      offset: self.getOffsetLength(piece, block)
    });
  }
};

PieceConductor.prototype.calculatePieceCounts = function (peers) {
  var self = this;
  // returns a sorted list of pieces we are interested in from the peer sorted based on how many other peers have the piece
  var pieceCounts = _.map(self.verified, function (v, index) {
    var counts = _.reduce(peers, function (memo, p) {
      return memo + Number(p.state.peer.bitfield.get(index));
    }, 0);
    return {
      counts: counts,
      index: index,
      verified: v
    };
  });
  self.pieceCounts = pieceCounts;
  return pieceCounts;
};

PieceConductor.prototype.onPieceBlocksComplete = function (piece) {
  var self = this;
  self.verifyPiece(piece.opts.index, piece.opts.pieceLength, function (err, verified) {
    if (err) return self.emit('error', err);
    if (verified) {
      self.emit('pieceComplete', piece.index);
      piece.complete();
    } else {
      // we got fucking issues
      piece.reset();
      console.log('piece verify failed - WE GOT FUCKING ISSUES');
    }
  });
};
// use this pattern everywhere
PieceConductor.prototype.onPieceComplete = function (piece) {
  var self = this;
  self.removePiece(piece, function () {});
};

PieceConductor.prototype.addPiece = function (piece, cb) {
  var self = this;
  self.pieces.push(piece);
  piece.on('blocksComplete', self.onPieceBlocksComplete);
  piece.on('complete', self.onPieceComplete);
  return cb(null, piece);
};

PieceConductor.prototype.removePiece = function (piece, cb) {
  var self = this;
  piece.removeListener('blocksComplete', self.onPieceBlocksComplete);
  piece.removeListener('complete', self.onPieceComplete);
  var index = _.indexOf(self.pieces, piece);
  self.pieces.splice(index, 1);
  return cb(null, piece);
};

PieceConductor.prototype.getOffsetLength = function (piece, block) {
  var self = this;
  var totalBytes = self.fileConductor.totalBytes();
  var start = (piece.opts.index * self.opts.pieceLength) + (block.index * self.opts.blockLength);
  var end = (piece.opts.index * self.opts.pieceLength) + ((block.index + 1) * self.opts.blockLength);
  if (end > totalBytes) {
    return {
      pieceIndex: piece.opts.index,
      pieceBegin: block.index * self.blockLength,
      blockLength: totalBytes - start
    };
  } else {
    return {
      pieceIndex: piece.opts.index,
      pieceBegin: block.index * self.blockLength,
      blockLength: self.blockLength
    };
  }
};

PieceConductor.prototype.registerFileConductor = function (conductor, cb) {
  var self = this;
  self.fileConductor = conductor;
  // need information about which pieces we have completed to be able to initialize the set of pieces we want to fetch next
  return cb(null);
};

PieceConductor.prototype.unregisterFileConductor = function (conductor, cb) {
  var self = this;
  if (self.fileConductor === conductor) {
    self.fileConductor = null;
  }
  return cb(null);
};

module.exports = PieceConductor;
