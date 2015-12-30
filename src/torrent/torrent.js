var url = require('url');
var crypto = require('crypto');
var events = require('events');
var util = require('util');
var bencode = require('bencode');

var _ = require('underscore');
var async = require('async');
var bn = require('bn.js');
var hat = require('hat');

var tracker = require('./../tracker');
var file = require('./../file');
var piece = require('./../piece');
var peer = require('./../peer');

// an object that represents a torrent (created from the raw metadata buffer)
function Torrent (opts, cb) {
  var self = this;
  events.EventEmitter.call(self);
  // metainfo is required
  if (_.isFunction(opts)) {
    cb = opts;
    self.opts = {};
  } else {
    self.opts = opts;
  }
  if (!self.opts.reserved) {
    self.opts.reserved = new Buffer(8);
    self.opts.reserved.fill(0);
  }
  self.decoded = bencode.decode(self.opts.metainfo);
  self.decoded_utf8 = bencode.decode(self.opts.metainfo, 'utf8');
  self._info = bencode.encode(self.decoded.info);
  self._info_hash = crypto.createHash('sha1').update(self._info).digest('hex');
  self.info_hash = new Buffer(self._info_hash, 'hex');
  if (!self.opts.type) {
    self.opts.type = 'filesystem';
  }
  if (self.decoded['info']['pieces'] % 20) throw new Error('pieces length is not a multiple of 20');
  self.numberPieces = self.decoded['info']['pieces'].length / 20;
  self.pieceLength = self.decoded_utf8['info']['piece length'];
  self.blockLength = 16384;
  self.clientRequestQueue = async.queue(function (task, cb) {
    self.emit('clientRequest', task, cb);
  }, 1);
  self.peerRequestQueue = async.queue(function (task, cb) {
    self.emit('peerRequest', task, cb);
  }, 1);
  self.peer_id = new Buffer(hat(160, 16), 'hex');
  return self.init(cb);
}
util.inherits(Torrent, events.EventEmitter);

Torrent.prototype.addPeer = function (peer, cb) {
  var self = this;
  return self.peerConductor.addPeer(peer, cb);
};

Torrent.prototype.removePeer = function (peer, cb) {
  var self = this;
  return self.peerConductor.removePeer(peer, cb);
};

Torrent.prototype._createFileConductor = function (cb) {
  var self = this;
  var fileConductorConstructor = self.opts.fileConductor ? self.opts.fileConductor[0] : file[self.opts.type].Conductor;
  var fileConductorOptions = self.opts.fileConductor ? self.opts.fileConductor[1] : {
    numPieces: self.numberPieces,
    pieceLength: self.pieceLength,
    pieceHashes: self.decoded['info']['pieces']
  };
  var fileConstructor = self.opts.file ? self.opts.file[0] : file[self.opts.type].File;

  function _instantiateConductor (cb) {
    return new fileConductorConstructor(fileConductorOptions, cb); 
  }

  function _instantiateFiles (conductor, cb) {
    var files = self.decoded_utf8['info']['files'];
    return async.mapSeries(files, function (f, cb) {
      var fileOptions = self.opts.file ? _.extend({}, self.opts.file[1]) : {
        prefix: ''
      };
      fileOptions.path = f.path;
      fileOptions.fileLength = f.length;
      // use path module here instead (or possible move this prefixing logic to the file constructor, and just modify options.prefix)
      fileOptions.path.unshift(fileOptions.prefix + '/' + self.decoded_utf8['info']['name']);
      return new fileConstructor(fileOptions, cb);
    }, cb);
  }

  function _addFiles (conductor, files, cb) {
    return async.eachSeries(files, function (file, cb) {
      return conductor.addFile(file, cb);
    }, cb);
  }

  return async.auto({
    instantiateConductor: [function (cb) {
      return _instantiateConductor(cb);
    }],
    instantiateFiles: ['instantiateConductor', function (cb, results) {
      var conductor = results.instantiateConductor;
      return _instantiateFiles(conductor, cb);
    }],
    addFiles: ['instantiateConductor', 'instantiateFiles', function (cb, results) {
      var conductor= results.instantiateConductor;
      var files = results.instantiateFiles;
      return _addFiles(conductor, files, cb);
    }]
  }, function (err, results) {
    if (err) return cb(err);
    var conductor = results.instantiateConductor;
    return cb(null, conductor);
  });

};

Torrent.prototype._createPieceConductor = function (fileConductor, cb) {
  var self = this;
  var pieceConductorConstructor = self.opts.pieceConductor ? self.opts.pieceConductor[0] : piece[self.opts.type].Conductor;
  var pieceConductorOptions = self.opts.pieceConductor ? self.opts.pieceConductor[1] : {
    numPieces: self.numberPieces,
    pieceLength: self.pieceLength,
    blockLength: self.blockLength,
    pieceHashes: self.decoded['info']['pieces']
  };

  function _instantiateConductor (cb) {
    return new pieceConductorConstructor(pieceConductorOptions, cb);
  }

  function _registerConductors (conductor, cb) {
    return async.series([
      function (cb) {
        return conductor.registerFileConductor(fileConductor, cb);
      }
    ], cb);
  }

  return async.auto({
    instantiateConductor: [
      function (cb) {
        return _instantiateConductor(cb);
      }
    ],
    registerConductors: [
      'instantiateConductor',
      function (cb, results) {
        var conductor = results.instantiateConductor;
        return _registerConductors(conductor, cb);
      }
    ],
    verifyPieces:[
      'instantiateConductor',
      'registerConductors',
      function (cb, results) {
        var conductor = results.instantiateConductor;
        conductor.verify(cb);
      }
    ]
  }, function (err, results) {
    if (err) return cb(err);
    var conductor = results.instantiateConductor;
    return cb(null, conductor);
  });

};

Torrent.prototype._createPeerConductor = function (fileConductor, pieceConductor, cb) {
  var self = this;
  var peerConductorConstructor = self.opts.peerConductor ? self.peerConductor[0] : peer.Conductor;
  var peerConductorOptions = self.opts.peerConductor ? self.peerConductor[1] : {
    info_hash: self.info_hash,
    peer_id: self.peer_id,
    reserved: self.opts.reserved,
    numberPieces: self.numberPieces
  };

  function _instantiateConductor (cb) {
    return new peerConductorConstructor(peerConductorOptions, cb);
  }

  function _registerConductors (conductor, cb) {
    return async.series([
      function (cb) {
        return conductor.registerFileConductor(fileConductor, cb);
      },
      function (cb) {
        return conductor.registerPieceConductor(pieceConductor, cb);
      }
    ], cb);
  }

  return async.auto({
    instantiateConductor: [
      function (cb) {
        return _instantiateConductor(cb);
      }
    ],
    registerConductors: [
      'instantiateConductor',
      function (cb, results) {
        var conductor = results.instantiateConductor;
        return _registerConductors(conductor, cb);
      }
    ]
  }, function (err, results) {
    if (err) return cb(err);
    var conductor = results.instantiateConductor;
    return cb(null, conductor);
  });

};

Torrent.prototype._createTrackerConductor = function (peerConductor, cb) {
  var self = this;
   // uploaded, downloaded need to be moved to be methods for the peerConductor
  // left should be a function call to fileConductor called totalBytesLeft
  self.downloaded = new bn(0);
  self.uploaded = new bn(0);
  self.left = new bn('FFFFFFFFFFFFFFFF', 16);

  var trackerConductorConstructor = self.opts.trackerConductor ? self.opts.trackerConductor[0] : tracker.Conductor;
  var trackerConductorOptions = self.opts.trackerConductor ? self.opts.trackerConductor[1] : {
    info_hash: self.info_hash,
    peer_id: self.peer_id,
    downloaded: self.downloaded,
    uploaded: self.uploaded,
    left: self.left,
    port: self.opts.port
  };

  function _instantiateConductor (cb) {
    return new trackerConductorConstructor(trackerConductorOptions, cb);
  }

  function _instantiateTrackers (conductor, cb) {
    var trackers = self.decoded_utf8['announce-list'] ? self.decoded_utf8['announce-list'] : [[self.decoded_utf8['announce']]];
    return async.map(trackers, function (level, cb) {
      async.map(level, function (address, cb) {
        var parsed = url.parse(address);
        if (parsed.protocol === 'udp:') {
          var options = {
            hostname: parsed.hostname,
            port: parsed.port
          };
          return new tracker.udp.client(options, cb);
        } else {
          return cb(null, parsed);
        }
      }, cb);
    }, cb);
  }

  function _addLevels (conductor, levels, cb) {
    return async.eachSeries(levels, function (level, cb) {
      return conductor.addLevel(level, cb);
    }, cb);
  }

  function _registerConductors (conductor, cb) {
    return async.series([
      function (cb) {
        return conductor.registerPeerConductor(peerConductor, cb);
      }
    ], cb);
  }

  return async.auto({
    instantiateConductor: [function (cb) {
      return _instantiateConductor(cb);
    }],
    instantiateTrackers: ['instantiateConductor', function (cb, results) {
      var conductor = results.instantiateConductor;
      return _instantiateTrackers(conductor, cb);
    }],
    addLevels: ['instantiateConductor', 'instantiateTrackers', function (cb, results) {
      var conductor = results.instantiateConductor;
      var levels = results.instantiateTrackers;
      return _addLevels(conductor, levels, cb);
    }],
    registerConductors: ['instantiateConductor', function (cb, results) {
      var conductor = results.instantiateConductor;
      return _registerConductors(conductor, cb);
    }]
  }, function (err, results) {
    if (err) return cb(err);
    var conductor = results.instantiateConductor;
    return cb(null, conductor);
  });

};

Torrent.prototype.init = function (cb) {
  var self = this;
    
  async.auto({
    createFileConductor: [
      function (cb) {
        return self._createFileConductor(cb);
      }
    ],
    createPieceConductor: [
      'createFileConductor',
      function (cb, results) {
        var fileConductor = results.createFileConductor;
        return self._createPieceConductor(fileConductor, cb);
      }
    ],
    createPeerConductor: [
      'createFileConductor',
      'createPieceConductor',
      function (cb, results) {
        var fileConductor = results.createFileConductor;
        var pieceConductor = results.createPieceConductor;
        return self._createPeerConductor(fileConductor, pieceConductor, cb);
      }
    ],
    createTrackerConductor: [
      'createPeerConductor',
      function (cb, results) {
        var peerConductor = results.createPeerConductor;
        return self._createTrackerConductor(peerConductor, cb);
      }
    ]
  }, function (err, results) {
    if (err) return cb(err);
    self.fileConductor = results.createFileConductor;
    self.pieceConductor = results.createPieceConductor;
    self.peerConductor = results.createPeerConductor;
    self.trackerConductor = results.createTrackerConductor;

    self.peerConductor.on('clientRequest', function (task, callback) {
      task.torrent = self;
      self.clientRequestQueue.push(task, callback);
    });
    self.peerConductor.on('peerRequest', function (task, callback) {
      task.torrent = self;
      self.peerRequestQueue.push(task, callback);
    });
    self.peerConductor.on('addPeer', function (peer) {
      self.clientRequestQueue.concurrency = self.peerConductor.peers.length;
      self.peerRequestQueue.concurrecny = self.peerConductor.peers.length;
    });
    return cb(null, self);
  });

};

Torrent.prototype.start = function (cb) {
  var self = this;
  self.trackerConductor.announce('started', cb);
};

Torrent.prototype.complete = function (cb) {
  var self = this;
  self.trackerConductor.announce('completed', cb);
};

Torrent.prototype.stop = function (cb) {
  var self = this;
  self.trackerConductor.announce('stopped', cb);
};



module.exports = Torrent;
