var _ = require('underscore');
var async = require('async');

var fs = require('fs');
var fse = require('fs-extra');
var path = require('path');

function File (opts, cb) {
  var self = this;
  // opts requires path and fileLength
  if (_.isFunction(opts)) {
    cb = opts;
    self.opts = {};
  } else {
    self.opts = opts;
  }
  self.pathConsecutive = _.map(_.range(1, self.opts.path.length), function (index) {
    return self.opts.path.slice(0, index);
  });
  return self.init(cb);
}

File.prototype.init = function (cb) {
  var self = this;
  async.eachSeries(self.pathConsecutive, function (piece, cb) {
    var currentPath = path.join.apply(self, piece);
    fs.stat(currentPath, function (err, stats) {
      if (stats) return cb(null);
      fs.mkdir(currentPath, function (err) {
        if (err && err.code === 'EEXIST') return cb(null);
        if (err) return cb(err);
        return cb(null);
      });
    });
  }, function (err) {
    if (err) return cb(err);
    var fullPath = path.join.apply(self, self.opts.path);
    fse.createFile(fullPath, function (err) {
      if (err) return cb(err);
      fs.open(fullPath, 'r+', function (err, fd) {
        if (err) return cb(err);
        self.fd = fd;
        fs.stat(fullPath, function (err, stat) {
          if (err) return cb(err);
          if (stat.size === self.opts.fileLength) return cb(null, self);
          var filler = new Buffer(1);
          filler.fill(0);
          fs.write(self.fd, filler, 0, filler.length, self.opts.fileLength - 1, function (err, bytesWritten, buffer) {
            if (err) return cb(err);
            return cb(null, self);
          });
        });
      });
    });
  });
};

File.prototype.read = function (start, end, cb) {
  var self = this;
  var buffer = new Buffer(end - start);
  fs.read(self.fd, buffer, 0, end - start, start, function (err, bytesRead, buffer) {
    if (err) return cb(err);
    return cb(null, buffer);
  });
};

File.prototype.write = function (start, block, cb) {
  var self = this;
  fs.write(self.fd, block, 0, block.length, start, function (err, bytesWritten, buffer) {
    if (err) return cb(err);
    return cb(null, buffer);
  });
};

module.exports = File;
