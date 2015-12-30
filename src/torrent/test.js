var Torrent = require('./torrent');

var fs = require('fs');

var metadata = fs.readFileSync('./../temp/test2.torrent');

var torrent = new Torrent({
  port: 51413,
  metainfo: metadata
});

torrent.start(function (err, tracker) {
  if (err) return console.log('err', err);
  console.log('started', tracker);
});

torrent.trackerConductor.on('announce', function (response) {
  console.log('announce event!', response);
});
