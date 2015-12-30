var net = require('net');
var events = require('events');
var util = require('util');

var _ = require('underscore');
var async = require('async');
var bufferEqual = require('buffer-equal');

var torrent = require('./../torrent');
var peer = require('./../peer');

function TCPServer (opts, cb) {
  var self = this;
  events.EventEmitter.call(self);
  // opts.port is required
  if (_.isFunction(opts)) {
    cb = opts;
    self.opts = {};
  } else {
    self.opts = opts;
  }

  self.reserved = new Buffer(8);
  self.reserved.fill(0);

  self.server = net.createServer(function (socket) {
    // insert logic to check if we have space for a new connection for server here (for now accept all connections);
    //console.log('NEW CONNECTION');
    var p = new peer.tcp(socket);
    p.wire.peer.on('handshake', function (handshake, decoded) {
      //self.emit('peerHandshake', p);
      var tor = _.find(self.torrentConductor.torrents, function (t) {
        return bufferEqual(t.info_hash, decoded.info_hash);
      });
      // the following should probably be changed to use peer.destroy (which should destroy the socket after cleanup)
      if (_.isUndefined(tor)) {
        self.emit('error', new Error('Invalid torrent connection request'));
        return socket.destroy();
      }
      p.info_hash = decoded.info_hash;
      // it's annoying that maxPieces needs to be defined beforehand to initialize the bitfield
      p.maxPieces = tor.numberPieces;
      tor.addPeer(p, function () {});
    });
    p.on('error', function (err) {
      var tor = _.find(self.torrentConductor.torrents, function (t) {
        return bufferEqual(t.info_hash, p.info_hash);
      });
      if (_.isUndefined(tor)) return socket.destroy();
      tor.removePeer(p, function (removeErr) {
        if (removeErr) {
          self.emit('error', err, removeErr, p);
        }
        socket.destroy();
      });
    });
  });
  return self.init(cb);
}

util.inherits(TCPServer, events.EventEmitter);

TCPServer.prototype.init = function (cb) {
  var self = this;
  self.torrentConductor = new torrent.Conductor({}, function (err) {
    if (err) return cb(err);
    return self.start(cb);
  });
};

TCPServer.prototype.start = function (cb) {
  var self = this;
  self.server.listen(self.opts.port, function (err) {
    if (err) return cb(err);
    async.each(self.torrentConductor.torrents, function (torrent, cb) {
      if (torrent.pieceConductor.complete) {
        //console.log('\n THIS TORRENT IS FUCKING DONE! \n', torrent);
        torrent.complete(cb);
      } else {
        //console.log('\n THIS TORRENT IS NOT FUCKING DONE! '\n', torrent);
        torrent.start(cb);
      }
    }, cb);
  });
};

TCPServer.prototype.addTorrent = function (torrent, cb) {
  var self = this;
  return self.torrentConductor.addTorrent(torrent, function (err) {
    if (err) return cb(err);
    if (torrent.pieceConductor.complete) {
      //console.log('\n THIS TORRENT IS FUCKING DONE! \n', torrent);
      torrent.complete(cb);
    } else {
      //console.log('\n THIS TORRENT IS NOT FUCKING DONE! \n', torrent);
      torrent.start(cb);
    }
    // emit 'addTorrent' (?)
  });
};

module.exports = TCPServer;
