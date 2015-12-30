// udp tracker client
var hat = require('hat');
var dgram = require('dgram');
var protocol = require('./../protocol').parser;
var translator = require('./../protocol').translator;
var definitions = require('./../protocol').auditor.definitions;

var _ = require('underscore');

// a UDP tracker
// change all this to use promises later (?)

function Tracker (opts, cb) {
  var self = this;
  if (_.isFunction(opts)) {
    cb = opts;
    self.opts = {};
  } else {
    self.opts = opts;
  }
  self.actions = definitions.GLOBAL.action;
  self.protocol = new protocol.Client();
  self.translator = new translator.Client();

  self.connection_id_timeout = 0;
  //self.socket = dgram.createSocket('udp4');
  // opts should hold timeout options
  self.interface.announce = _.bind(self.interface.announce, self);
  return self.init(cb);
}

Tracker.prototype.init = function (cb) {
  var self = this;
  return cb(null, self);
};

Tracker.prototype.genTransactionBuffer = function () {
  return new Buffer(hat(32, 16), 'hex');
};

Tracker.prototype.looper =  function (n, cb) {
  var self = this;
  if (n > 8) return cb(new Error('request timed out'));
  return setTimeout(function () {
    n = n + 1;
    cb(null, n);
  }, self.timeout(n));
};

Tracker.prototype.timeout = function (n) {
  return 15 * Math.pow(2, n) * 1000;
};

Tracker.prototype.connect = function (cb) {
  var self = this;
  var opts = {};
  opts.action = self.actions.connect;
  opts.connection_id = definitions.GLOBAL.DEFAULT_CONNECTION_ID;
  opts.transaction_id = self.genTransactionBuffer();
  self._connect(opts, cb);
};

// implement an initial connect timeout, so that we can easily implement
// rotating tracker priority: http://bittorrent.org/beps/bep_0012.html
// this way, we can randomize which tracker to try, attempt to connect,
// and if the connect is not successful within say 5 seconds, we can move
// onto the next tracker (?)
Tracker.prototype._connect = function (opts, cb) {
  var self = this;
  var socket = dgram.createSocket('udp4');
  var message = self.translator.actions.send.connect.encode(opts);
  var timeout;

  socket.on('message', messageHandler);
  socket.on('error', errorHandler);

  function messageHandler (response) {
    var decoded;
    self.protocol.actions.receive.connect(response, function (err) {
      if (err) return cb(err);
      decoded = self.translator.actions.receive.connect.decode(response);
      cleanSocket(socket);
      self.connection_id = decoded.connection_id;
      self.connection_id_timeout = new Date().getTime() + (60 * 1000);
      return cb(null, decoded);
    });
  }

  function errorHandler (err) {
    console.error('connect', err);
    cleanSocket(socket);
    return cb(err);
  }

  function cleanSocket (socket) {
    clearTimeout(timeout);
    socket.removeListener('error', errorHandler);
    socket.removeListener('message', messageHandler);
    socket.close();
  }

  function loop (err, n) {
    if (err) return errorHandler(err);
    self.protocol.actions.send.connect(message, function (err) {
      if (err) return errorHandler(err);
      socket.send(message, 0, message.length, self.opts.port, self.opts.hostname);
      timeout = self.looper(n, loop);
    });
  }

  loop(null, 0);

};

Tracker.prototype.ensureLiveConnection = function (cb) {
  var self = this;
  var now = new Date().getTime();
  if (now > self.connection_id_timeout) {
    self.connect(function (err) {
      if (err) return cb(err);
      cb();
    });
  } else {
    cb();
  }
};

Tracker.prototype.announceParseResponse = function (response) {
  return {
    action: response.slice(0, 4),
    transaction_id: response.slice(4, 8),
    interval: response.slice(8, 12),
    leechers: response.slice(12, 16),
    seeders: response.slice(16, 20),
    peers: response.slice(20)
  };
};

Tracker.prototype.announce = function (opts, cb) {
  var self = this;
  self.ensureLiveConnection(function (err) {
    if (err) return cb(err);
    opts.action = self.actions.announce;
    opts.connection_id = self.connection_id ? self.connection_id : definitions.GLOBAL.DEFAULT_CONNECTION_ID;
    opts.transaction_id = self.genTransactionBuffer();
    self._announce(opts, cb);
  });
};

Tracker.prototype._announce = function (opts, cb) {
  var self = this;
  var socket = dgram.createSocket('udp4');
  var message = self.translator.actions.send.announce.encode(opts);
  var timeout;

  socket.on('message', messageHandler);
  socket.on('error', errorHandler);

  function messageHandler (response) {
    var decoded;
    self.protocol.actions.receive.announce(response, function (err) {
      if (err) return cb(err);
      decoded = self.translator.actions.receive.announce.decode(response);
      cleanSocket(socket);
      return cb(null, decoded);
    });
  }

  function errorHandler (err) {
    console.error('announce', err);
    cleanSocket(socket);
    return cb(err);
  }

  function cleanSocket (socket) {
    clearTimeout(timeout);
    socket.removeListener('error', errorHandler);
    socket.removeListener('message', messageHandler);
    socket.close();
  }

  function loop (err, n) {
    if (err) return errorHandler(err);
    self.protocol.actions.send.announce(message, function (err) {
      if (err) return errorHandler(err);
      socket.send(message, 0, message.length, self.opts.port, self.opts.hostname);
      timeout = self.looper(n, loop);
    });
  }

  loop(null, 0);

};

Tracker.prototype.scrape = function (opts, cb) {
  var self = this;
  self.ensureLiveConnection(function (err) {
    if (err) return cb(err);
    opts.action = self.actions.scrape;
    opts.connection_id = self.connection_id ? self.connection_id : definitions.GLOBAL.DEFAULT_CONNECTION_ID;
    opts.transaction_id = self.genTransactionBuffer();
    self._scrape(opts, cb);
  });
};

Tracker.prototype._scrape = function () {

};

Tracker.prototype.interface = {};

Tracker.prototype.interface.announce = function (opts, cb) {
  var self = this;

  function genInt16Buffer (int) {
    var buffer = new Buffer(2);
    buffer.writeUInt16BE(int, 0);
    return buffer;
  }

  function genInt32Buffer (int) {
    var buffer = new Buffer(4);
    buffer.writeUInt32BE(int, 0);
    return buffer;
  }

  var eventMap = {
    'none': 0,
    'completed': 1,
    'started': 2,
    'stopped': 3
  };

  opts.downloaded = new Buffer(opts.downloaded.toArray('be', 8));
  opts.left = new Buffer(opts.left.toArray('be', 8));
  opts.uploaded = new Buffer(opts.uploaded.toArray('be', 8));
  opts.ip_address = genInt32Buffer(opts.ip_address);
  opts.key = genInt32Buffer(opts.key);
  opts.num_want = genInt32Buffer(opts.num_want);
  opts.port = genInt16Buffer(opts.port);
  opts.event = genInt32Buffer(eventMap[opts.event]);
  return self.announce(opts, cb);
};

module.exports = Tracker;
