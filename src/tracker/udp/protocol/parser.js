var _ = require('underscore');
var bufferEqual = require('buffer-equal');

var auditor = require('./auditor');
var translator = require('./translator');

function Client () {
  var self = this;
  self.auditor = new auditor.Client();
  self.translator = new translator.Client();
  self.transactions = [];
  self.connection_id = null;
  self.connection_id_timeout = 0;
  self.actions.send.connect = _.bind(self.actions.send.connect, self);
  self.actions.send.announce = _.bind(self.actions.send.announce, self);
  self.actions.send.scrape = _.bind(self.actions.send.scrape, self);
  self.actions.receive.connect = _.bind(self.actions.receive.connect, self);
  self.actions.receive.announce = _.bind(self.actions.receive.announce, self);
  self.actions.receive.scrape = _.bind(self.actions.receive.scrape, self);
  //self.actions.receive.error = _.bind(self.actions.receive.error, self);
}

Client.prototype.interval = function (transaction, cb) {
  var self = this;
  if (!(_.isObject(self.announce_last) && _.isNumber(self.announce_interval))) return cb(null);
  var difference = transaction.timestamp - self.announce_last.timestamp;
  var sameEvent = bufferEqual(self.announce_last.event, transaction.event);
  if (sameEvent && (difference < (self.announce_interval * 1000))) return cb(new Error('announcing at an interval less than the one specified by the tracker'));
  return cb(null);
};

Client.prototype.throttling = function (transaction, cb) {
  var self = this;
  var pending = _.filter(self.transactions, function (t) {
    return bufferEqual(t.transaction_id, transaction.transaction_id);
  });
  var last, delay;
  if (_.isEmpty(pending)) return cb(null);
  last = _.last(pending);
  delay = (15 * Math.pow(2, pending.length - 2) * 1000);
  if ((transaction.timestamp - last.timestamp) < delay) return cb(new Error('request is not being throttled'));
  return cb(null);
};

Client.prototype.originator = function (transaction, cb) {
  var self = this;
  var exists = _.find(self.transactions, function (t) {
    return bufferEqual(t.transaction_id, transaction.transaction_id);
  });
  if (_.isUndefined(exists)) return cb(new Error('transaction_id was not sent previously by the client'));
  return cb(null);
};

Client.prototype.live = function (transaction, cb) {
  var self = this;
  if (transaction.timestamp > self.connection_id_timeout) return cb(new Error('connection_id has expired'));
  return cb(null);
};

Client.prototype.throttlingAndLive = function (transaction, cb) {
  var self = this;
  self.live(transaction, function (err) {
    if (err) return cb(err);
    self.throttling(transaction, function (err) {
      if (err) return cb(err);
      cb(null);
    });
  });
};

Client.prototype.addTransaction = function (transaction) {
  var self = this;
  self.transactions.push(transaction);
  return self.transactions;
};

Client.prototype.removeTransaction = function (transaction) {
  var self = this;
  self.transactions = _.difference(self.transactions, _.filter(self.transactions, function (t) {
    return bufferEqual(t.transaction_id, transaction.transaction_id);
  }));
  return self.transactions;
};

Client.prototype.actions = {};

Client.prototype.actions.send = {};

Client.prototype.actions.receive = {};

Client.prototype.actions.send.connect = function (buffer, cb) {
  var self = this;
  var now = new Date().getTime();
  var decoder = self.translator.actions.send.connect.decode;
  var decoded = Buffer.isBuffer(buffer) ? decoder(buffer) : buffer;
  decoded.timestamp = now;
  self.throttling(decoded, function (err) {
    if (err) return cb(err);
    self.auditor.actions.send.connect(buffer, function (err, buffer) {
      if (err) return cb(err);
      self.addTransaction(decoded);
      return cb(null, buffer);
    });
  });
};

Client.prototype.actions.receive.connect = function (buffer, cb) {
  var self = this;
  var now = new Date().getTime();
  var decoder = self.translator.actions.receive.connect.decode;
  var decoded = Buffer.isBuffer(buffer) ? decoder(buffer): buffer;
  decoded.timestamp = now;
  self.auditor.actions.receive.connect(buffer, function (err, buffer) {
    if (err) return cb(err);
    self.originator(decoded, function (err) {
      if (err) return cb(err);
      self.connection_id = decoded.connection_id;
      self.connection_id_timeout = new Date().getTime() + (60 * 1000);
      self.removeTransaction(decoded);
      return cb(null, buffer);
    });
  });
};

Client.prototype.actions.send.announce = function (buffer, cb) {
  var self = this;
  var now = new Date().getTime();
  var decoder = self.translator.actions.send.announce.decode;
  var decoded = Buffer.isBuffer(buffer) ? decoder(buffer) : buffer;
  decoded.timestamp = now;
  self.throttlingAndLive(decoded, function (err) {
    if (err) return cb(err);
    self.auditor.actions.send.announce(buffer, function (err, buffer) {
      if (err) return cb(err);
      self.interval(decoded, function (err) {
        if (err) return cb(err);
        self.addTransaction(decoded);
        self.announce_last = decoded;
        return cb(null, buffer);
      });
    }); 
  });
};

Client.prototype.actions.receive.announce = function (buffer, cb) {
  var self = this;
  var now = new Date().getTime();
  var decoder = self.translator.actions.receive.announce.decode;
  var decoded = Buffer.isBuffer(buffer) ? decoder(buffer) : buffer;
  decoded.timestamp = now;
  self.auditor.actions.receive.announce(buffer, function (err, buffer) {
    if (err) return cb(err);
    self.originator(decoded, function (err) {
      if (err) return cb(err);
      self.removeTransaction(decoded);
      self.announce_interval = decoded.interval.readUInt32BE(0);
      return cb(null, buffer);
    });
  });
};

Client.prototype.actions.send.scrape = function (buffer, cb) {
  var self = this;
  var now = new Date().getTime();
  var decoder = self.translator.actions.send.scrape.decode;
  var decoded = Buffer.isBuffer(buffer) ? decoder(buffer) : buffer;
  decoded.timestamp = now;
  self.throttlingAndLive(decoded, function (err) {
    if (err) return cb(err);
    self.auditor.actions.send.scrape(buffer, function (err, buffer) {
      if (err) return cb(err);
      self.addTransaction(decoded);
      return cb(null, buffer);
    });
  });
};

Client.prototype.actions.receive.scrape = function (buffer, cb) {
  var self = this;
  var now = new Date().getTime();
  var decoder = self.translator.actions.receive.scrape.decode;
  var decoded = Buffer.isBuffer(buffer) ? decoder(buffer) : buffer;
  decoded.timestamp = now;
  self.auditor.actions.receive.scrape(buffer, function (err, buffer) {
    if (err) return cb(err);
    self.originator(decoded, function (err) {
      if (err) return cb(err);
      self.removeTransaction(decoded);
      return cb(null, buffer);
    });
  });
};

module.exports = {
  Client: Client
};
