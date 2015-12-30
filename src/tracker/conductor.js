var events = require('events');
var util = require('util');
var net = require('net');

var _ = require('underscore');
var async = require('async');

var peer = require('./../peer');

function TrackerConductor (opts, cb) {
  var self = this;
  if (_.isFunction(opts)) {
    cb = opts;
    self.opts = {};
  } else {
    self.opts = opts;
  }
  //self.port = opts.port;
  //self.info_hash = opts.info_hash;
  //self.peer_id = opts.peer_id;
  //self.downloaded = opts.downloaded;
  //self.left = opts.left;
  //self.uploaded = opts.uploaded;
  self.trackers = [];
  events.EventEmitter.call(self);
  self.init(cb);
}

util.inherits(TrackerConductor, events.EventEmitter);

TrackerConductor.prototype.init = function (cb) {
  var self = this;
  return cb(null, self);
};

TrackerConductor.prototype.addLevel = function (level, cb) {
  var self = this;
  self.trackers.push(level);
  _.each(level, function (tracker) {
    self.emit('addTracker', tracker);
  });
  self.emit('addLevel', level);
  return cb(null, level);
};

TrackerConductor.prototype.addPeersFromResponse = function (response) {
  var self = this;
  var parsed = [];
  var peers = response.peers;
  var peerNumber = peers.length / 6;
  for (var i = 0; i < peerNumber; i += 1) {
    parsed.push({
      host: peers[i * 6] + '.' + peers[i * 6 + 1] + '.' + peers[i * 6 + 2] + '.' + peers[i * 6 + 3],
      port: peers.readUInt16BE(i * 6 + 4)
    });
  }
  _.each(parsed, function (address) {
    var socket = new net.Socket({
      readable: true,
      writable: true
    });
    socket.connect({
      port: address.port,
      host: address.host
    });
    socket.on('connect', function () {
      var p = new peer.tcp(socket);
      // we have to attach peer to socket for the error handling on the socket
      socket.peer = p;
      p.wire.peer.on('handshake', function () {
        p.maxPieces = self.peerConductor.numberPieces;
        self.peerConductor.addPeer(p, function () {});
      });
      p.on('error', function (err) {
        self.peerConductor.removePeer(p, function (removeErr) {
          if (removeErr) {
            self.emit('error', err, removeErr, p);
          }
          return socket.destroy();
        });
      });
    });
    // we need this because we are reaching out. we can error out before connecting
    socket.on('error', function (err) {
      if (socket.peer) {
        self.peerConductor.removePeer(socket.peer, function (removeErr) {
          if (removeErr) {
            self.emit('error', err, removeErr, socket.peer);
          }
          socket.destroy();
        });
      } else {
        socket.destroy();
      }
    });
  });
};

TrackerConductor.prototype.announce = function (event, cb) {
  var self = this;
  async.detectSeries(self.trackers, function (level, cb) {
    async.detectSeries(level, function (tracker, callback) {
      if (!_.isObject(tracker.interface)) return cb(false);
      if (!_.isFunction(tracker.interface.announce)) return cb(false);
      //if (tracker.opts.hostname !== 'open.demonii.com') return cb(false);
      tracker.interface.announce({
        event: event,
        peer_id: self.opts.peer_id,
        info_hash: self.opts.info_hash,
        downloaded: self.opts.downloaded,
        left: self.opts.left,
        uploaded: self.opts.uploaded,
        ip_address: 0,
        key: 0,
        num_want: 25,
        port: self.opts.port
      }, function (err, response) {
        if (err) return cb(false);
        self.addPeersFromResponse(response);
        self.emit('announce', response);
        level = _.without(level, tracker);
        level.unshift(tracker);
        return callback(true);
      });
    }, function (result) {
      if (_.isUndefined(result)) {
        return cb(false);
      } else {
        return cb(true);
      }
    });
  }, function (result) {
    if (_.isUndefined(result)) return cb(new Error('failed to announce to any trackers'));
    return cb(null, result);
  });
};

TrackerConductor.prototype.registerPeerConductor = function (peerConductor, cb) {
  var self = this;
  self.peerConductor = peerConductor;
  // do shit with peer conductor here
  return cb(null);
};

TrackerConductor.prototype.unregisterPeerConductor = function (peerConductor, cb) {
  var self = this;
  if (self.peerConductor === peerConductor) {
    self.peerConductor = null;
  }
  return cb(null);
};

module.exports = TrackerConductor;
