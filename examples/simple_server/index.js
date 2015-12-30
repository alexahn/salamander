var fs = require('fs');

var salamander = require('./../../src');

var _ = require('underscore');

/*
var util = require('util');
setInterval(function () {
  console.log(util.inspect(process.memoryUsage()));
}, 1000);
*/

var server = new salamander.server.tcp({
  port: 51413
}, function (err) {
  if (err) throw err;
  console.log('server started');
  var metadata = fs.readFileSync('./torrents/test.torrent');

  var t = new salamander.torrent.Torrent({
    metainfo: metadata,
    reserved: server.reserved,
    port: server.opts.port,
    file: [salamander.file.filesystem.File, {
      prefix: './downloaded'
    }]
  }, function (err) {
    if (err) return console.log(err);
    server.addTorrent(t, function (err) {
      if (err) throw err;
      console.log('torrent added');
    });

    var start = new Date().getTime();
    var end = t.pieceConductor.complete ? new Date().getTime() : null;
    var blocksDownloaded = 0;
    var blocksUploaded = 0;

    t.pieceConductor.on('complete', function () {
      end = new Date().getTime();
      console.log('[torrent completed]');
    });

    t.pieceConductor.on('pieceComplete', function (index) {
      console.log('[piece completed]', index);
    });

    t.pieceConductor.on('processPeerRequest', function () {
      blocksUploaded += 1;
    });

    t.pieceConductor.on('processPeerPiece', function () {
      blocksDownloaded += 1;
    });

    t.peerConductor.on('error', function (err, reason, peer) {
      console.log('peerConductor error', err);
    });

    t.peerConductor.on('peerError', function (err, peer) {
      console.log('peerConductor peerError', err);
    });

    t.trackerConductor.on('error', function (err, reason, peer) {
      console.log('trackerConductor error', err);
    });

    setInterval(function () {
      var completed = _.reduce(t.pieceConductor.verified, function (memo, val) {
        return memo + Number(val);
      }, 0);
      console.log('\n');
      console.log('PEER CONNECTIONS: ', t.peerConductor.peers.length);
      console.log('PIECES COMPLETED: ', completed);
      console.log('BLOCKS UPLOADED: ', blocksUploaded);
      blocksUploaded = 0;
      if (end) {
        console.log('COMPLETION TIME: ', (end - start) / 1000);
      } else {
        console.log('BLOCKS DOWNLOADED: ', blocksDownloaded);
        blocksDownloaded = 0;
      }
      console.log('\n');
    }, 10000);

  });

  server.on('error', function (err, reason, peer) {
    console.log('server error', err);
  });

});
