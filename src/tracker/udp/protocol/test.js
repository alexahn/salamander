var async = require('async');

function message (cb) {
  var j = 0;
  var queue = async.queue(function (message, callback) {
    j += 1;
    if (j > 10) {
      callback(new Error('wtf'));
    } else {
      console.log('processed', message);
      callback();
    }
  }, 1);
  var  i = 0;
  queue.drain = function () {
    queue.kill();
    return cb(null);
  };
  while (i < 20) {
    //console.log(i);
    queue.push('hello ' + i, function (err) {
      if (err) {
        queue.kill();
        return cb(err);
      }
    });
    i += 1;
  }
  if (!queue.started) {
    return cb(null);
  }
}

message(function (err) {
  if (err) return console.error(err);
  console.log('done');
});
