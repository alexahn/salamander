# salamander

A set of modules for writing BitTorrent applications.

## Installation
```
$ npm install salamander
```

## Examples

```javascript
var fs = require('fs');
var salamander = require('salamander');

var server = new salamander.server.tcp({
  port: 51413
}, function (err) {
  if (err) throw err;
  var metadata = fs.readFileSync('./torrents/test.torrent');
  var t = new salamander.torrent.Torrent({
    metainfo: metadata,
    reserved: server.reserved,
    port: server.opts.port,
    file: [salamander.file.filesystem.File, {
      prefix: './downloaded'
    }]
  }, function (err) {
    if (err) throw err;
    server.addTorrent(t, function (err) {
      if (err) throw err;
    });
  });
});
```

## Current State and Motivations
The project aims to create a visibly correct implementation of the BitTorrent protocol by implementing the protocol via contracts. Contracts act as third parties that moderate all input and output to designate blame; for example, in the case of the peer protocol, the peer contract keeps track of all interaction from a client to a peer, and if a peer were to send the incorrect protocol headers, then that peer would be assigned blame. The current implementation is minimal but working. The UDP tracker contract follows the UDP tracker specification closely. The BitTorrent peer protocol contract follows the specification for the most part, but can use some improvement. Currently, only UDP trackers are supported. Only filesystem downloads are supported. Only regular TCP connections are supported. Bandwidth throttling has been taken to account during the design of the modules, but has not yet been implemented - same for number of peer connections. The current block selection algorithm works by randomly choosing an incomplete piece, and then sequentially iterating over the blocks; for a more robust implementation the block selection algorithm should switch to the rarest first algorithm after first downloading a fixed number of random pieces first. Buffer based downloads have been taken into account during the design of the modules to eventually support streaming capabilities without having to commit the entirety of a torrent to memory or disk.

## License

  MIT
