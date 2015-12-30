function Client () {}

Client.prototype.actions = {};

Client.prototype.actions.send = {};

Client.prototype.actions.receive = {};

Client.prototype.actions.send.connect = {};

Client.prototype.actions.send.connect.encode = function (obj) {
  return Buffer.concat([
    obj.connection_id,
    obj.action,
    obj.transaction_id
  ]);
};

Client.prototype.actions.send.connect.decode = function (buffer) {
  return {
    connection_id: buffer.slice(0, 8),
    action: buffer.slice(8, 12),
    transaction_id: buffer.slice(12, 16)
  };
};

Client.prototype.actions.send.announce = {};

Client.prototype.actions.send.announce.encode = function (obj) {
  return Buffer.concat([
    obj.connection_id,
    obj.action,
    obj.transaction_id,
    obj.info_hash,
    obj.peer_id,
    obj.downloaded,
    obj.left,
    obj.uploaded,
    obj.event,
    obj.ip_address,
    obj.key,
    obj.num_want,
    obj.port
  ]);
};

Client.prototype.actions.send.announce.decode = function (buffer) {
  return {
    connection_id: buffer.slice(0, 8),
    action: buffer.slice(8, 12),
    transaction_id: buffer.slice(12, 16),
    info_hash: buffer.slice(16, 36),
    peer_id: buffer.slice(36, 56),
    downloaded: buffer.slice(56, 64),
    left: buffer.slice(64, 72),
    uploaded: buffer.slice(72, 80),
    event: buffer.slice(80, 84),
    ip_address: buffer.slice(84, 88),
    key: buffer.slice(88, 92),
    num_want: buffer.slice(92, 96),
    port: buffer.slice(96, 98)
  };
};

Client.prototype.actions.send.scrape = {};

Client.prototype.actions.send.scrape.encode = function (obj) {
  return Buffer.concat([
    obj.connection_id,
    obj.action,
    obj.transaction_id,
    obj.info_hash
  ]);
};

Client.prototype.actions.send.scrape.decode = function (buffer) {
  return {
    connection_id: buffer.slice(0, 8),
    action: buffer.slice(8, 12),
    transaction_id: buffer.slice(12, 16),
    info_hash: buffer.slice(16)
  };
};

function Server () {}

Server.prototype.actions = {};

Server.prototype.actions.send = {};

Server.prototype.actions.receive = {};

Server.prototype.actions.send.connect = {};

Server.prototype.actions.send.connect.encode = function (obj) {
  return Buffer.concat([
    obj.action,
    obj.transaction_id,
    obj.connection_id
  ]);
};

Server.prototype.actions.send.connect.decode = function (buffer) {
  return {
    action: buffer.slice(0, 4),
    transaction_id: buffer.slice(4, 8),
    connection_id: buffer.slice(8, 16)
  };
};

Server.prototype.actions.send.announce = {};

Server.prototype.actions.send.announce.encode = function (obj) {
  return Buffer.concat([
    obj.action,
    obj.transaction_id,
    obj.interval,
    obj.leechers,
    obj.seeders,
    // deviating from terms used in http://www.bittorrent.org/beps/bep_0015.html for simplicity
    obj.peers
  ]);
};

Server.prototype.actions.send.announce.decode = function (buffer) {
  return {
    action: buffer.slice(0, 4),
    transaction_id: buffer.slice(4, 8),
    interval: buffer.slice(8, 12),
    leechers: buffer.slice(12, 16),
    seeders: buffer.slice(16, 20),
    peers: buffer.slice(20)
  };
};

Server.prototype.actions.send.scrape = {};

Server.prototype.actions.send.scrape.encode = function (obj) {
  return Buffer.concat([
    obj.action,
    obj.transaction_id,
    // deviating from terms used in http://www.bittorrent.org/beps/bep_0015.html for simplicity
    obj.status
  ]);
};

Server.prototype.actions.send.scrape.decode = function (buffer) {
  return {
    action: buffer.slice(0, 4),
    transaction_id: buffer.slice(4, 8),
    status: buffer.slice(8)
  };
};

Server.prototype.actions.send.error = {};

Server.prototype.actions.send.error.encode = function (obj) {
  return Buffer.concat([
    obj.action,
    obj.transaction_id,
    obj.message
  ]);
};

Server.prototype.actions.send.error.decode = function (buffer) {
  return {
    action: buffer.slice(0, 4),
    transaction_id: buffer.slice(4, 8),
    message: buffer.slice(8)
  };
};

Server.prototype.actions.receive.connect = Client.prototype.actions.send.connect;
Server.prototype.actions.receive.announce = Client.prototype.actions.send.announce;
Server.prototype.actions.receive.scrape = Client.prototype.actions.send.scrape;
Client.prototype.actions.receive.connect = Server.prototype.actions.send.connect;
Client.prototype.actions.receive.announce = Server.prototype.actions.send.announce;
Client.prototype.actions.receive.scrape = Server.prototype.actions.send.scrape;
Client.prototype.actions.receive.error = Server.prototype.actions.send.error;

module.exports = {
  Client: Client,
  Server: Server
};
