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
}

export function matchAll(string, regex) {
  let matches = [];

  let match;
  while ((match = regex.exec(string)) !== null) {
    delete match['index'];
    delete match['input'];
    matches.push(match);
  }

  return matches;
}

export function sortVersions(allVersions, callback) {
  for (let minecraftVersion in allVersions) {
    let versions = allVersions[minecraftVersion];

    // Sort versions by build number
    versions.sort((a, b) => (a.id - b.id));
  }

  if (typeof callback === 'function') return callback(null, allVersions);
}
