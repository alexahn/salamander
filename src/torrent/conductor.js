var events = require('events');
var util = require('util');

var _ = require('underscore');
var async = require('async');

function TorrentConductor (opts, cb) {
  var self = this;
  events.EventEmitter.call(self);
  self.torrents = [];
  // for requests the client sends to peers
  self.clientRequestQueue = async.queue(function (task, callback) {
    task.torrent.pieceConductor.processClientRequest(task.peer, task.peers, function (err, selected) {
      if (err) return callback(err);
      // error out here because of no block (?)
      if (!selected) return callback();
      var obj = {
        piece_index: new Buffer(4),
        piece_begin: new Buffer(4),
        block_length: new Buffer(4)
      };
      obj.piece_index.writeUInt32BE(selected.offset.pieceIndex, 0);
      obj.piece_begin.writeUInt32BE(selected.offset.pieceBegin, 0);
      obj.block_length.writeUInt32BE(selected.offset.blockLength, 0);
      task.peer.request(obj);
      return callback();
    }); 
  }, 1);
  // for requests that peers send to client
  self.peerRequestQueue = async.queue(function (task, callback) {
    task.torrent.pieceConductor.processPeerRequest(task.decoded, function (err, buffer) {
      if (err) return callback(err);
      var obj = {
        message_length: new Buffer(4),
        piece_index: task.decoded.piece_index,
        piece_begin: task.decoded.piece_begin,
        block: buffer
      };
      obj.message_length.writeUInt32BE(buffer.length + 9, 0);
      task.peer.piece(obj);
      return callback();
    });
  }, 1);
  self.onTorrentClientRequest = _.bind(self.onTorrentClientRequest, self);
  self.onTorrentPeerRequest = _.bind(self.onTorrentPeerRequest, self);
  return self.init(cb);
}

util.inherits(TorrentConductor, events.EventEmitter);

TorrentConductor.prototype.init = function (cb) {
  var self = this;
  return cb(null, self);
};

TorrentConductor.prototype.onTorrentClientRequest = function (task, callback) {
  var self = this;
  self.clientRequestQueue.push(task, callback);
};

TorrentConductor.prototype.onTorrentPeerRequest = function (task, callback) {
  var self = this;
  self.peerRequestQueue.push(task, callback);
};

TorrentConductor.prototype.addTorrent = function (torrent, cb) {
  var self = this;
  torrent.on('clientRequest', self.onTorrentClientRequest);
  torrent.on('peerRequest', self.onTorrentPeerRequest);
  self.torrents.push(torrent);
  self.emit('addTorrent', torrent);
  return cb(null, torrent);
};

TorrentConductor.prototype.removeTorrent = function (torrent, cb) {
  var self = this;
  if (!_.contains(self.torrents, torrent)) return cb(new Error('Torrent not found in list'));
  torrent.removeListener('clientRequest', self.onTorrentClientRequest);
  torrent.removeListener('peerRequest', self.onTorrentPeerRequest);
  self.torrents = _.without(self.torrents, torrent);
  self.emit('removeTorrent', torrent);
  return cb(null, torrent);
};

module.exports = TorrentConductor;
