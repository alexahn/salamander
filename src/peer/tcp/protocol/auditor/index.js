var _ = require('underscore');
var async = require('async');

var conditions = require('./conditions');
var translator = require('./../translator');

function Peer () {
  var self = this;
  self.translators = {
    peer: new translator.Peer()
  };
  self.actions.send.handshake = _.bind(self.actions.send.handshake, self);
  self.actions.send.message.keep_alive = _.bind(self.actions.send.message.keep_alive, self);
  self.actions.send.message.choke = _.bind(self.actions.send.message.choke, self);
  self.actions.send.message.unchoke = _.bind(self.actions.send.message.unchoke, self);
  self.actions.send.message.interested = _.bind(self.actions.send.message.interested, self);
  self.actions.send.message.not_interested = _.bind(self.actions.send.message.not_interested, self);
  self.actions.send.message.have = _.bind(self.actions.send.message.have, self);
  self.actions.send.message.bitfield = _.bind(self.actions.send.message.bitfield, self);
  self.actions.send.message.request = _.bind(self.actions.send.message.request, self);
  self.actions.send.message.piece = _.bind(self.actions.send.message.piece, self);
  self.actions.send.message.cancel = _.bind(self.actions.send.message.cancel, self);
  self.actions.send.message.port = _.bind(self.actions.send.message.port, self);
  self.actions.receive.handshake = _.bind(self.actions.receive.handshake, self);
  self.actions.receive.message.keep_alive = _.bind(self.actions.receive.message.keep_alive, self);
  self.actions.receive.message.choke = _.bind(self.actions.receive.message.choke, self);
  self.actions.receive.message.unchoke = _.bind(self.actions.receive.message.unchoke, self);
  self.actions.receive.message.interested = _.bind(self.actions.receive.message.interested, self);
  self.actions.receive.message.not_interested = _.bind(self.actions.receive.message.not_interested, self);
  self.actions.receive.message.have = _.bind(self.actions.receive.message.have, self);
  self.actions.receive.message.bitfield = _.bind(self.actions.receive.message.bitfield, self);
  self.actions.receive.message.request = _.bind(self.actions.receive.message.request, self);
  self.actions.receive.message.piece = _.bind(self.actions.receive.message.piece, self);
  self.actions.receive.message.cancel = _.bind(self.actions.receive.message.cancel, self);
  self.actions.receive.message.port = _.bind(self.actions.receive.message.port, self);
}

Peer.prototype.verifyAction = function (party, actions, buffer, cb) {
  var self = this;
  var decoder = _.reduce(actions, function (memo, action) {
    return memo[action];
  }, self.translators[party].actions).decode;
  var decoded = decoder(buffer);
  var actionConditions = _.reduce(actions, function (memo, action) {
    return memo[action];
  }, conditions[party].actions);
  var boundConditions = _.map(actionConditions, function (fn) {
    return function (callback) {
      fn(buffer, decoded, callback);
    };
  });
  async.parallel(boundConditions, function (err) {
    if (err) return cb(err);
    return cb(null, decoded);
  });
};


Peer.prototype.actions = {};

Peer.prototype.actions.send = {};

Peer.prototype.actions.receive = {};

Peer.prototype.actions.send.handshake = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'handshake'], buffer, cb);
};

Peer.prototype.actions.send.message = {};

Peer.prototype.actions.send.message.keep_alive = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'keep_alive'], buffer, cb);
};

Peer.prototype.actions.send.message.choke = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'choke'], buffer, cb);
};

Peer.prototype.actions.send.message.unchoke = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'unchoke'], buffer, cb);
};

Peer.prototype.actions.send.message.interested = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'interested'], buffer, cb);
};

Peer.prototype.actions.send.message.not_interested = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'not_interested'], buffer, cb);
};

Peer.prototype.actions.send.message.have = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'have'], buffer, cb);
};

Peer.prototype.actions.send.message.bitfield = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'bitfield'], buffer, cb);
};

Peer.prototype.actions.send.message.request = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'request'], buffer, cb);
};

Peer.prototype.actions.send.message.piece = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'piece'], buffer, cb);
};

Peer.prototype.actions.send.message.cancel = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'cancel'], buffer, cb);
};

Peer.prototype.actions.send.message.port = function (buffer, cb) {
  var self = this;
  self.verifyAction('peer', ['send', 'message', 'port'], buffer, cb);
};

Peer.prototype.actions.receive.handshake = Peer.prototype.actions.send.handshake;

Peer.prototype.actions.receive.message = Peer.prototype.actions.send.message;

module.exports = {
  Peer: Peer
};
