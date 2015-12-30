var _ = require('underscore');
var async = require('async');
var bufferEqual = require('buffer-equal');

var definitions = require('./definitions');

var conditions = {};

conditions.peer = {};
conditions.peer.actions = {};

conditions.peer.actions.send = {};
conditions.peer.actions.send.handshake = [
  function (buffer, decoded, cb) {
    if (!(buffer.length === 68)) return cb(new Error('handshake payload invalid length'));
    return cb(null);
  },
  genConditionFromDefinition('peer', ['send', 'handshake'])  
];

conditions.peer.actions.send.message = {};
conditions.peer.actions.send.message.keep_alive = [
  genConditionFromMessageLength('peer', ['send', 'message', 'keep_alive']),
  genConditionFromDefinition('peer', ['send', 'message', 'keep_alive'])
];
conditions.peer.actions.send.message.choke = [
  genConditionFromMessageLength('peer', ['send', 'message', 'choke']),
  genConditionFromDefinition('peer', ['send', 'message', 'choke'])
];
conditions.peer.actions.send.message.unchoke = [
  genConditionFromMessageLength('peer', ['send', 'message', 'unchoke']),
  genConditionFromDefinition('peer', ['send', 'message', 'unchoke'])
];
conditions.peer.actions.send.message.interested = [
  genConditionFromMessageLength('peer', ['send', 'message', 'interested']),
  genConditionFromDefinition('peer', ['send', 'message', 'interested'])
];
conditions.peer.actions.send.message.not_interested = [
  genConditionFromMessageLength('peer', ['send', 'message', 'not_interested']),
  genConditionFromDefinition('peer', ['send', 'message', 'not_interested'])
];
conditions.peer.actions.send.message.have = [
  genConditionFromMessageLength('peer', ['send', 'message', 'have']),
  genConditionFromDefinition('peer', ['send', 'message', 'have'])
];
conditions.peer.actions.send.message.bitfield = [
  genConditionFromMessageLength('peer', ['send', 'message', 'bitfield']),
  genConditionFromDefinition('peer', ['send', 'message', 'bitfield'])
];
conditions.peer.actions.send.message.request = [
  genConditionFromMessageLength('peer', ['send', 'message', 'request']),
  genConditionFromDefinition('peer', ['send', 'message', 'request'])
];
conditions.peer.actions.send.message.piece = [
  genConditionFromMessageLength('peer', ['send', 'message', 'piece']),
  genConditionFromDefinition('peer', ['send', 'message', 'piece'])
];
conditions.peer.actions.send.message.cancel = [
  genConditionFromMessageLength('peer', ['send', 'message', 'cancel']),
  genConditionFromDefinition('peer', ['send', 'message', 'cancel'])
];
conditions.peer.actions.send.message.port = [
  genConditionFromMessageLength('peer', ['send', 'message', 'port']),
  genConditionFromDefinition('peer', ['send', 'message', 'port'])
];

conditions.peer.actions.receive = conditions.peer.actions.send;


function genConditionFromMessageLength (party, actions) {
  return function messageLengthHandler (buffer, decoded, cb) {
    var message_length = buffer.slice(0, 4);
    var message_length_int = message_length.readUInt32BE(0);
    if (!(message_length_int === (buffer.length - 4))) return cb(new Error(_.last(actions), 'invalid message body length'));
    return cb(null);
  };
}

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
