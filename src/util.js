import fs from 'fs';
import { spawn } from 'child_process';

export function loadJson(file) {
  let lock = false;
  let localData = '';

  // Check if file exists
  const stats = fs.statSync(file);
  if (fs.existsSync(file)) {
    if (lock) return;
    lock = true;

    try {
      return JSON.parse(fs.readFileSync(file));
    } catch (err) {
      throw err;
    }
  }
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

export function sortVersions(allVersions) {
  for (let minecraftVersion in allVersions) {
    let versions = allVersions[minecraftVersion];

    // Sort versions by build number
    allVersions[minecraftVersion] = versions.sort((a, b) => (a.id - b.id));
  }

  console.log(allVersions);

  return allVersions;
}

export function unbzip2(data) {
  let proc = spawn('bunzip2', [ '-d', '-c' ]);
  let output = '';

  return new Promise((resolve, reject) => {
    proc.on('error', reject);
    proc.stdout.on('data', chunk => output += chunk);
    proc.stderr.pipe(process.stderr);

    proc.on('exit', (code, signal) => {
      if (code || signal)
        return reject(new Error('Code: ' + (code || signal)));

      resolve();
    });

    proc.stdin.end(data);
  });
}
