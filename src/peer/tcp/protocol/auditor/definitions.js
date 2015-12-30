// static messages will be encoded here

function genByte (n) {
  var buffer = new Buffer(1);
  buffer.fill(n);
  return buffer;
}

function genUInt32BE (n) {
  var buffer = new Buffer(4);
  buffer.writeUInt32BE(n, 0);
  return buffer;
}

var definitions = {};

definitions.GLOBAL = {};
definitions.GLOBAL.pstrlen = genByte(19);
definitions.GLOBAL.pstr = new Buffer('BitTorrent protocol');
definitions.GLOBAL.message_id = {
  choke: genByte(0),
  unchoke: genByte(1),
  interested: genByte(2),
  not_interested: genByte(3),
  have: genByte(4),
  bitfield: genByte(5),
  request: genByte(6),
  piece: genByte(7),
  cancel: genByte(8),
  port: genByte(9)
};
definitions.GLOBAL.message_length  = {
  keep_alive: genUInt32BE(0),
  choke: genUInt32BE(1),
  unchoke: genUInt32BE(1),
  interested: genUInt32BE(1),
  not_interested: genUInt32BE(1),
  have: genUInt32BE(5),
  request: genUInt32BE(13),
  cancel: genUInt32BE(13),
  port: genUInt32BE(3)
};
definitions.GLOBAL.message = {
  keep_alive: Buffer.concat([
    definitions.GLOBAL.message_length.keep_alive
  ]),
  choke: Buffer.concat([
    definitions.GLOBAL.message_length.choke,
    definitions.GLOBAL.message_id.choke
  ]),
  unchoke: Buffer.concat([
    definitions.GLOBAL.message_length.unchoke,
    definitions.GLOBAL.message_id.unchoke
  ]),
  interested: Buffer.concat([
    definitions.GLOBAL.message_length.interested,
    definitions.GLOBAL.message_id.interested
  ]),
  not_interested: Buffer.concat([
    definitions.GLOBAL.message_length.not_interested,
    definitions.GLOBAL.message_id.not_interested
  ])
};

definitions.peer = {};

definitions.peer.actions = {};

definitions.peer.actions.send = {};

definitions.peer.actions.send.handshake = {
  pstrlen: definitions.GLOBAL.pstrlen,
  pstr: definitions.GLOBAL.pstr
};

definitions.peer.actions.send.message = {};
definitions.peer.actions.send.message.choke = {
  message_length: definitions.GLOBAL.message_length.choke,
  message_id: definitions.GLOBAL.message_id.choke
};
definitions.peer.actions.send.message.unchoke = {
  message_length: definitions.GLOBAL.message_length.unchoke,
  message_id: definitions.GLOBAL.message_id.unchoke
};
definitions.peer.actions.send.message.interested = {
  message_length: definitions.GLOBAL.message_length.interested,
  message_id: definitions.GLOBAL.message_id.interested
};
definitions.peer.actions.send.message.not_interested = {
  message_length: definitions.GLOBAL.message_length.not_interested,
  message_id: definitions.GLOBAL.message_id.not_interested
};
definitions.peer.actions.send.message.have = {
  message_length: definitions.GLOBAL.message_length.have,
  message_id: definitions.GLOBAL.message_id.have
};
definitions.peer.actions.send.message.bitfield = {
  message_id: definitions.GLOBAL.message_id.bitfield
};
definitions.peer.actions.send.message.request = {
  message_length: definitions.GLOBAL.message_length.request,
  message_id: definitions.GLOBAL.message_id.request
};
definitions.peer.actions.send.message.piece = {
  message_id: definitions.GLOBAL.message_id.piece
};
definitions.peer.actions.send.message.cancel = {
  message_length: definitions.GLOBAL.message_length.cancel,
  message_id: definitions.GLOBAL.message_id.cancel
};
definitions.peer.actions.send.message.port = {
  message_length: definitions.GLOBAL.message_length.port,
  message_id: definitions.GLOBAL.message_id.port
};

definitions.peer.actions.receive = definitions.peer.actions.send;

module.exports = definitions;
