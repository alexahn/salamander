var events = require('events');
var util = require('util');

var _ = require('underscore');
var async = require('async');

function FileConductor (opts, cb) {
  var self = this;
  events.EventEmitter.call(self);
  // numPieces, pieceLength are required
  if (_.isFunction(opts)) {
    cb = opts;
    self.opts = {};
  } else {
    self.opts = opts;
  }
  self.files = [];
  return self.init(cb);
}

util.inherits(FileConductor, events.EventEmitter);

FileConductor.prototype.init = function (cb) {
  var self = this;
  return cb(null, self);
};

FileConductor.prototype.totalBytes = function () {
  var self = this;
  return _.reduce(self.files, function (memo, f) {
    return memo + f.opts.fileLength;
  }, 0);
};

FileConductor.prototype.addFile = function (file, cb) {
  var self = this;
  var totalBytes = _.reduce(self.files, function (memo, f) {
    return memo + f.opts.fileLength;
  }, 0);
  file.startByte = totalBytes;
  file.endByte = totalBytes + file.opts.fileLength;
  self.files.push(file);
  self.emit('addFile', file);
  return cb(null, file);
};

FileConductor.prototype.write = function (pieceIndex, pieceOffset, block, cb) {
  var self = this;
  var startByte = pieceIndex * self.opts.pieceLength + pieceOffset;
  var endByte = pieceIndex * self.opts.pieceLength + pieceOffset + block.length;
  // find out which file(s) we need to ask from
  var queries = _.map(self.files, function (f) {
    if (startByte <= f.startByte && endByte >= f.endByte && endByte >= f.startByte && startByte < f.endByte) {
      var start = 0;
      var end = f.fileLength;
      var blockStart = f.startByte - startByte;
      var blockEnd = f.endByte - startByte;
      return {
        start: start,
        end: end,
        file: f,
        block: block.slice(blockStart, blockEnd)
      };
    } else if (startByte <= f.startByte && endByte <= f.endByte && endByte >= f.startByte && startByte < f.endByte) {
      var start = 0;
      var end = endByte - f.startByte;
      var blockStart = f.startByte - startByte;
      var blockEnd = blockStart + (endByte - f.startByte);
      return {
        start: start,
        end: end,
        file: f,
        block: block.slice(blockStart, blockEnd)
      };
    } else if (startByte >= f.startByte && endByte <= f.endByte && endByte >= f.startByte && startByte < f.endByte) {
      var start = startByte - f.startByte;
      var end = endByte - f.startByte;
      var blockStart = 0;
      var blockEnd = block.length;
      return {
        start: start,
        end: end,
        file: f,
        block: block.slice(blockStart, blockEnd)
      };
    } else if (startByte >= f.startByte && endByte >= f.endByte && endByte >= f.startByte && startByte < f.endByte) {
      var start = startByte - f.startByte;
      var end = f.fileLength;
      var blockStart = 0;
      var blockEnd = f.endByte - startByte;
      return {
        start: start,
        end: end,
        file: f,
        block: block.slice(blockStart, blockEnd)
      };
    } else {
      return null;
    }
  });
  async.map(_.compact(queries), function (q, cb) {
    q.file.write(q.start, q.block, cb);
  }, function (err, results) {
    if (err) return cb(err);
    return cb(null, Buffer.concat(results));
  });
};

FileConductor.prototype.read = function (pieceIndex, pieceOffset, blockLength, cb) {
  var self = this;
  var startByte = pieceIndex * self.opts.pieceLength + pieceOffset;
  var endByte = pieceIndex * self.opts.pieceLength + pieceOffset + blockLength;
  // find out which file(s) we need to ask from
  var queries = _.map(self.files, function (f) {
    if (startByte <= f.startByte && endByte >= f.endByte && endByte >= f.startByte && startByte < f.endByte) {
      var start = 0;
      var end = f.opts.fileLength;
      return {
        start: start,
        end: end,
        file: f
      };
    } else if (startByte <= f.startByte && endByte <= f.endByte && endByte >= f.startByte && startByte < f.endByte) {
      var start = 0;
      var end = endByte - f.startByte;
      return {
        start: start,
        end: end,
        file: f
      };
    } else if (startByte >= f.startByte && endByte <= f.endByte && endByte >= f.startByte && startByte < f.endByte) {
      var start = startByte - f.startByte;
      var end = endByte - f.startByte;
      return {
        start: start,
        end: end,
        file: f
      };
    } else if (startByte >= f.startByte && endByte >= f.endByte && endByte >= f.startByte && startByte < f.endByte) {
      var start = startByte - f.startByte;
      var end = f.opts.fileLength;
      return {
        start: start,
        end: end,
        file: f
      };
    } else {
      return null;
    }
  });
  async.map(_.compact(queries), function (q, cb) {
    q.file.read(q.start, q.end, cb);
  }, function (err, results) {
    if (err) return cb(err);
    return cb(null, Buffer.concat(results));
  });
};

module.exports = FileConductor;
