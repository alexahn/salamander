var events = require('events');
var util = require('util');

var _ = require('underscore');

function Piece (opts, cb) {
  var self = this;
  events.EventEmitter.call(self);
  // index, and pieceLength are required
  if (_.isFunction(opts)) {
    cb = opts;
    self.opts = {};
  } else {
    self.opts = opts;
  }
  // we may consider getting rid of these
  self.index = opts.index;
  self.pieceLength = opts.pieceLength;
  self.numBlocks = Math.ceil(opts.pieceLength / 16384);
  return self.init(cb);
}
util.inherits(Piece, events.EventEmitter);

Piece.prototype.init = function (cb) {
  var self = this;
  self.blocks = [];
  _.each(_.range(self.numBlocks), function (val, index) {
    self.blocks.push({
      index: index,
      received: false
    });
  });
  return cb(null, self);
};

// this may need to be an event emitter
// so that we can announce completion of piece on last block set
Piece.prototype.setBlock = function (index) {
  var self = this;
  //console.log('index', index, self.blocks[index]);
  self.blocks[index].received = true;
  if (self.blocksCompleted()) {
    self.blocksComplete = true;
    self.emit('blocksComplete', self);
  }
};

Piece.prototype.complete = function () {
  var self = this;
  self.completed = true;
  self.emit('complete', self);
};

Piece.prototype.blocksCompleted = function () {
  var self = this;
  return _.every(_.map(self.blocks, function (b) {
    return b.received;
  }));
};

Piece.prototype.reset = function () {
  var self = this;
  self.blocksComplete = false;
  self.blocks = _.map(self.blocks, function (b) {
    b.received = false;
    return b;
  });
};

module.exports = Piece;
