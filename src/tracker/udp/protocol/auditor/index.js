var _ = require('underscore');
var async = require('async');

var definitions = require('./definitions');
var conditions = require('./conditions');
var translator = require('./../translator');

function Client () {
  var self = this;
  self.translators = {
    client: new translator.Client(),
    server: new translator.Server()
  };
  self.actions.send.connect = _.bind(self.actions.send.connect, self);
  self.actions.send.announce = _.bind(self.actions.send.announce, self);
  self.actions.send.scrape = _.bind(self.actions.send.scrape, self);
  self.actions.receive.connect = _.bind(self.actions.receive.connect, self);
  self.actions.receive.announce = _.bind(self.actions.receive.announce, self);
  self.actions.receive.scrape = _.bind(self.actions.receive.scrape, self);
  self.actions.receive.error = _.bind(self.actions.receive.error, self);
}

Client.prototype.verifyAction = function (party, actions, buffer, cb) {
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
  async.parallel(boundConditions, cb);
};

Client.prototype.actions = {};

Client.prototype.actions.send = {};
Client.prototype.actions.send.connect = function (buffer, cb) {
  var self = this;
  self.verifyAction('client', ['send', 'connect'], buffer, cb);
};
Client.prototype.actions.send.announce = function (buffer, cb) {
  var self = this;
  self.verifyAction('client', ['send', 'announce'], buffer, cb);
};
Client.prototype.actions.send.scrape = function (buffer, cb) {
  var self = this;
  self.verifyAction('client', ['send', 'scrape'], buffer, cb);
};


function Server () {
  var self = this;
  self.translators = {
    client: new translator.Client(),
    server: new translator.Server()
  };
  self.actions.send.connect = _.bind(self.actions.send.connect, self);
  self.actions.send.announce = _.bind(self.actions.send.announce, self);
  self.actions.send.scrape = _.bind(self.actions.send.scrape, self);
  self.actions.send.error = _.bind(self.actions.send.error, self);
  self.actions.receive.connect = _.bind(self.actions.receive.connect, self);
  self.actions.receive.announce = _.bind(self.actions.receive.announce, self);
  self.actions.receive.scrape = _.bind(self.actions.receive.scrape, self);
}

Server.prototype.verifyAction = function (party, actions, buffer, cb) {
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
  async.parallel(boundConditions, cb);
};

Server.prototype.actions = {};

Server.prototype.actions.send = {};
Server.prototype.actions.send.connect = function (buffer, cb) {
  var self = this;
  self.verifyAction('server', ['send', 'connect'], buffer, cb);
};
Server.prototype.actions.send.announce = function (buffer, cb) {
  var self = this;
  self.verifyAction('server', ['send', 'announce'], buffer, cb);
};
Server.prototype.actions.send.scrape = function (buffer, cb) {
  var self = this;
  self.verifyAction('server', ['send', 'scrape'], buffer, cb);
};
Server.prototype.actions.send.error = function (buffer, cb) {
  var self = this;
  self.verifyAction('server', ['send', 'error'], buffer, cb);
};


Server.prototype.actions.receive = {};
Server.prototype.actions.receive.connect = Client.prototype.actions.send.connect;
Server.prototype.actions.receive.announce = Client.prototype.actions.send.announce;
Server.prototype.actions.receive.scrape = Client.prototype.actions.send.scrape;

Client.prototype.actions.receive = {};
Client.prototype.actions.receive.connect = Server.prototype.actions.send.connect;
Client.prototype.actions.receive.announce = Server.prototype.actions.send.announce;
Client.prototype.actions.receive.scrape = Server.prototype.actions.send.scrape;
Client.prototype.actions.receive.error = Server.prototype.actions.send.error;

module.exports = {
  Client: Client,
  Server: Server,
  definitions: definitions
};
