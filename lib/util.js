import fs from 'fs';

export function loadJson(file, callback) {
  let lock = false;
  let localData = '';

  // Check if file exists
  fs.stat(file, (err, stats) => {
    if (err) return callback(err);

    fs.createReadStream(file)
      .on('data', (data) => {
        localData += data.toString();
      })
      .once('error', (err) => {
        if (lock) return;
        lock = true;

        return callback(err);
      })
      .once('end', () => {
        if (lock) return;
        lock = true;

        try {
          return callback(null, JSON.parse(localData));
        } catch (err) {
          return callback(err);
        }
      });
  });
};
