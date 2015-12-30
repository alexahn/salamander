function Peer () {}

Peer.prototype.actions = {};

Peer.prototype.actions.send = {};

Peer.prototype.actions.send.handshake = {};
Peer.prototype.actions.send.handshake.encode = function (obj) {
  return Buffer.concat([
    obj.pstrlen,
    obj.pstr,
    obj.reserved,
    obj.info_hash,
    obj.peer_id
  ]);
};
Peer.prototype.actions.send.handshake.decode = function (buffer) {
  return {
    pstrlen: buffer.slice(0, 1),
    pstr: buffer.slice(1, 20),
    reserved: buffer.slice(20, 28),
    info_hash: buffer.slice(28, 48),
    peer_id: buffer.slice(48, 68)
  };
};

Peer.prototype.actions.send.message = {};

Peer.prototype.actions.send.message.keep_alive = {};
Peer.prototype.actions.send.message.keep_alive.encode = function (obj) {
  return Buffer.concat([
    obj.message_length
  ]);
};
Peer.prototype.actions.send.message.keep_alive.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4)
  };
};

Peer.prototype.actions.send.message.choke = {};
Peer.prototype.actions.send.message.choke.encode = function (obj) {
  return Buffer.concat([
    obj.message_length,
    obj.message_id
  ]);
};
Peer.prototype.actions.send.message.choke.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4),
    message_id: buffer.slice(4, 5)
  };
};

Peer.prototype.actions.send.message.unchoke = {};
Peer.prototype.actions.send.message.unchoke.encode = function (obj) {
  return Buffer.concat([
    obj.message_length,
    obj.message_id
  ]);
};
Peer.prototype.actions.send.message.unchoke.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4),
    message_id: buffer.slice(4, 5)
  };
};

Peer.prototype.actions.send.message.interested = {};
Peer.prototype.actions.send.message.interested.encode = function (obj) {
  return Buffer.concat([
    obj.message_length,
    obj.message_id
  ]);
};
Peer.prototype.actions.send.message.interested.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4),
    message_id: buffer.slice(4, 5)
  };

};

Peer.prototype.actions.send.message.not_interested = {};
Peer.prototype.actions.send.message.not_interested.encode = function (obj) {
  return Buffer.concat([
    obj.message_length,
    obj.message_id
  ]);
};
Peer.prototype.actions.send.message.not_interested.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4),
    message_id: buffer.slice(4, 5)
  };
};

Peer.prototype.actions.send.message.have = {};
Peer.prototype.actions.send.message.have.encode = function (obj) {
  return Buffer.concat([
    obj.message_length,
    obj.message_id,
    obj.piece_index
  ]);
};
Peer.prototype.actions.send.message.have.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4),
    message_id: buffer.slice(4, 5),
    piece_index: buffer.slice(5)
  };
};

Peer.prototype.actions.send.message.bitfield = {};
Peer.prototype.actions.send.message.bitfield.encode = function (obj) {
  return Buffer.concat([
    obj.message_length,
    obj.message_id,
    obj.bitfield
  ]);
};
Peer.prototype.actions.send.message.bitfield.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4),
    message_id: buffer.slice(4, 5),
    bitfield: buffer.slice(5)
  };
};

Peer.prototype.actions.send.message.request = {};
Peer.prototype.actions.send.message.request.encode = function (obj) {
  return Buffer.concat([
    obj.message_length,
    obj.message_id,
    obj.piece_index,
    obj.piece_begin,
    obj.block_length
  ]);
};
Peer.prototype.actions.send.message.request.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4),
    message_id: buffer.slice(4, 5),
    piece_index: buffer.slice(5, 9),
    piece_begin: buffer.slice(9, 13),
    block_length: buffer.slice(13, 18)
  };
};

Peer.prototype.actions.send.message.piece = {};
Peer.prototype.actions.send.message.piece.encode = function (obj) {
  return Buffer.concat([
    obj.message_length,
    obj.message_id,
    obj.piece_index,
    obj.piece_begin,
    obj.block
  ]);
};
Peer.prototype.actions.send.message.piece.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4),
    message_id: buffer.slice(4, 5),
    piece_index: buffer.slice(5, 9),
    piece_begin: buffer.slice(9, 13),
    block: buffer.slice(13)
  };
};

Peer.prototype.actions.send.message.cancel = {};
Peer.prototype.actions.send.message.cancel.encode = function (obj) {
  return Buffer.concat([
    obj.message_length,
    obj.message_id,
    obj.piece_index,
    obj.piece_begin,
    obj.block_length
  ]);
};
Peer.prototype.actions.send.message.cancel.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4),
    message_id: buffer.slice(4, 5),
    piece_index: buffer.slice(5, 9),
    piece_begin: buffer.slice(9, 13),
    block_length: buffer.slice(13)
  };
};

Peer.prototype.actions.send.message.port = {};
Peer.prototype.actions.send.message.port.encode = function (obj) {
  return Buffer.concat([
    obj.message_length,
    obj.message_id,
    obj.listen_port
  ]);
};
Peer.prototype.actions.send.message.port.decode = function (buffer) {
  return {
    message_length: buffer.slice(0, 4),
    message_id: buffer.slice(4, 5),
    listen_port: buffer.slice(5)
  };
};

Peer.prototype.actions.receive = {};
Peer.prototype.actions.receive.handshake = Peer.prototype.actions.send.handshake;

Peer.prototype.actions.receive.message = {};
Peer.prototype.actions.receive.message.choke = Peer.prototype.actions.send.message.choke;
Peer.prototype.actions.receive.message.unchoke = Peer.prototype.actions.send.message.unchoke;
Peer.prototype.actions.receive.message.interested = Peer.prototype.actions.send.message.interested;
Peer.prototype.actions.receive.message.not_interested = Peer.prototype.actions.send.message.uninterested;
Peer.prototype.actions.receive.message.have = Peer.prototype.actions.send.message.have;
Peer.prototype.actions.receive.message.bitfield = Peer.prototype.actions.send.message.bitfield;
Peer.prototype.actions.receive.message.request = Peer.prototype.actions.send.message.request;
Peer.prototype.actions.receive.message.piece = Peer.prototype.actions.send.message.piece;
Peer.prototype.actions.receive.message.cancel = Peer.prototype.actions.send.message.cancel;
Peer.prototype.actions.receive.message.port = Peer.prototype.actions.send.message.port;

module.exports = {
  Peer: Peer
};
