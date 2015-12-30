var _ = require('underscore');

var definitions = {};

function int32Buffer (number) {
  var buf = new Buffer(4);
  buf.writeUInt32BE(number, 0);
  return buf;
}

definitions.GLOBAL = {};

definitions.GLOBAL.action = {};
definitions.GLOBAL.action.connect = int32Buffer(0);
definitions.GLOBAL.action.announce = int32Buffer(1);
definitions.GLOBAL.action.scrape = int32Buffer(2);
definitions.GLOBAL.action.error = int32Buffer(3);

definitions.GLOBAL.event = {};
definitions.GLOBAL.event.none = int32Buffer(0);
definitions.GLOBAL.event.completed = int32Buffer(1);
definitions.GLOBAL.event.started = int32Buffer(2);
definitions.GLOBAL.event.stopped = int32Buffer(3);

definitions.GLOBAL.DEFAULT_CONNECTION_ID = Buffer.concat([
  int32Buffer(0x417),
  int32Buffer(0x27101980)
]);

// (party, action) definitions
definitions.client = {};

definitions.client.actions = {};

definitions.client.actions.send = {};
definitions.client.actions.send.connect = {
  connection_id: definitions.GLOBAL.DEFAULT_CONNECTION_ID,
  action: definitions.GLOBAL.action.connect
};
definitions.client.actions.send.announce = {
  action: definitions.GLOBAL.action.announce,
  event: _.values(definitions.GLOBAL.event)
};
definitions.client.actions.send.scrape = {
  action: definitions.GLOBAL.action.scrape
};

definitions.server = {};

definitions.server.actions = {};

definitions.server.actions.send = {};
definitions.server.actions.send.connect = {
  action: definitions.GLOBAL.action.connect
};
definitions.server.actions.send.announce = {
  action: definitions.GLOBAL.action.announce
};
definitions.server.actions.send.scrape = {
  action: definitions.GLOBAL.action.scrape
};
definitions.server.actions.send.error = {
  action: definitions.GLOBAL.action.error
};

definitions.server.actions.receive = {};
definitions.server.actions.receive.connect = definitions.client.actions.send.connect;
definitions.server.actions.receive.announce = definitions.client.actions.send.announce;
definitions.server.actions.receive.scrape = definitions.client.actions.send.scrape;

definitions.client.actions.receive = {};
definitions.client.actions.receive.connect = definitions.server.actions.send.connect;
definitions.client.actions.receive.announce = definitions.server.actions.send.announce;
definitions.client.actions.receive.scrape = definitions.server.actions.send.scrape;
definitions.client.actions.receive.error = definitions.server.actions.send.error;


module.exports = definitions;
