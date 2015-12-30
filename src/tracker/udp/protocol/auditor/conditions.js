var _ = require('underscore');
var async = require('async');

var bufferEqual = require('buffer-equal');

var definitions = require('./definitions');

var conditions = {};

conditions.client = {};
conditions.client.actions = {};
conditions.server = {};
conditions.server.actions = {};

// (party, action) conditions

conditions.client.actions.send = {};
conditions.client.actions.send.connect = [
  function (buffer, decoded, cb) {
    if (!(buffer.length === 16)) return cb(new Error('connect request payload is invalid length'));
    return cb(null);
  },
  genConditionFromDefinition('client', ['send', 'connect'])
];
conditions.client.actions.send.announce = [
  function (buffer, decoded, cb) {
    if (!(buffer.length === 98)) return cb(new Error('announce request payload is invalid length'));
    return cb(null);
  },
  genConditionFromDefinition('client', ['send', 'announce'])
];
conditions.client.actions.send.scrape = [
  function (buffer, decoded, cb) {
    if ((buffer.length - 16) % 20) return cb(new Error('scrape request payload is invalid length'));
    return cb(null);
  },
  genConditionFromDefinition('client', ['send', 'scrape'])
];


conditions.server.actions.send = {};
conditions.server.actions.send.connect = [
  function (buffer, decoded, cb) {
    if (!(buffer.length === 16)) return cb(new Error('connect response payload is invalid length'));
    return cb(null);
  },
  genConditionFromDefinition('server', ['send', 'connect'])
];
conditions.server.actions.send.announce = [
  function (buffer, decoded, cb) {
    if ((buffer.length - 20) % 6) return cb(new Error('announce response payload is invalid length'));
    return cb(null);
  },
  genConditionFromDefinition('server', ['send', 'announce'])
];
conditions.server.actions.send.scrape = [
  function (buffer, decoded, cb) {
    if ((buffer.length - 8) % 12) return cb(new Error('scrape response payload is invalid length'));
    return cb(null);
  },
  genConditionFromDefinition('server', ['send', 'scrape'])
];
conditions.server.actions.send.error = [
  function (buffer, decoded, cb) {
    if (buffer.length < 8) return cb(new Error('error response payload is invalid length'));
    return cb(null);
  },
  genConditionFromDefinition('server', ['send', 'error'])
];

conditions.server.actions.receive = {};
conditions.server.actions.receive.connect = conditions.client.actions.send.connect;
conditions.server.actions.receive.announce = conditions.client.actions.send.announce;
conditions.server.actions.receive.scrape = conditions.client.actions.send.scrape;

conditions.client.actions.receive = {};
conditions.client.actions.receive.connect = conditions.server.actions.send.connect;
conditions.client.actions.receive.announce = conditions.server.actions.send.announce;
conditions.client.actions.receive.scrape = conditions.server.actions.send.scrape;
conditions.client.actions.receive.error = conditions.server.actions.send.error;

// returns a conditions that uses the (party, action) definitions to enforce either equality or membership
function genConditionFromDefinition (party, actions) {
  return function definitionHandler (buffer, decoded, cb) {
    var definition = _.reduce(actions, function (memo, action) {
      return memo[action];
    }, definitions[party].actions);
    var attrs = _.keys(definition);
    async.each(attrs, function (attr, callback) {
      var value = decoded[attr];
      var defined = definition[attr];
      var isBuffer = Buffer.isBuffer(defined);
      var isArray = _.isArray(defined);
      if (isBuffer && !bufferEqual(value, defined)) return callback(new Error(_.last(actions) + ' ' + attr + ' is invalid'));
      if (isArray) {
        var filtered = _.filter(defined, function (option) {
          return bufferEqual(option, value);
        });
        if (!_.some(filtered)) return callback(new Error(_.last(actions) + ' ' + attr + ' has an invalid option'));
      }
      return callback(null);
    }, cb);
  };
}


module.exports = conditions;
