import path from 'path';
import url from 'url';
import async from 'async';
import debug from 'debug';
import request from 'request';
import parser from '../parser';
import decoder from '../decoder';
import { loadJson } from '../util';

class Source {

  constructor(name, url, options = { }) {
    this.name = name;
    this.url = url;

    this.id = options._id;
    this.ignoredPackages = options.ignore || [];
    this.format = options.format || 'raw';
    this.encoding = options.encoding;

    this.log = debug('gen:source:' + this.name);
  }

  scrape(callback) {
    this.fetch((err, packages) => {
      if (err) return callback(err);

      // Filter
      if (Array.isArray(packages)) {
        this.log(`Filtering ${packages.length} items`);
        packages = packages.filter(::this.filter);
        this.log(`Processing ${packages.length} items`);
      }

      // Process
      packages = this.process(packages);

      return callback(null, packages);
    });
  }

  fetch(callback) {
    this.log('Fetching resources');

    async.parallel([
      ::this.fetchRemote,
      ::this.fetchLocal
    ], (err, results) => {
      if (err) return callback(err);

      results = mergePackages(results);
      return callback(null, results);
    });
  }

  fetchRemote(callback) {
    this.request(callback);
  }

  fetchLocal(callback) {
    let localDataPath = path.join(__dirname, '..', '..', 'data', this.id + '.json');

    loadJson(localDataPath, (err, data) => {
      if (err && err.code === 'ENOENT') return callback();

      return callback(err, data);
    });
  }

  request(path, options, callback) {
    if (typeof path === 'function') {
      callback = path;
      path = '';
      options = { };
    } else if (typeof options === 'function') {
      callback = options;
      options = { };
    }

    if (!options) {
      options = { };
    }

    options.headers = options.headers || {};
    if (!options.headers['User-Agent']) options.headers['User-Agent'] = 'Node.js';

    options.url = options.url || url.resolve(this.url, path);
    options.encoding = null;

    request(options, (err, res, body) => {
      if (err) return callback(err);

      if (res.statusCode !== 200) {
        err = new Error('Invalid status code: ' + res.statusCode + '; ' + body);
        err.code = res.statusCode;

        return callback(err);
      }

      this.preprocess(body, options, callback);
    });
  }

  preprocess(data, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = { };
    }

    let { encoding, format } = this;

    if (options.encoding) encoding = options.encoding;
    if (options.format) format = options.format;

    decoder(encoding, data, (err, data) => {
      if (err) return callback(err);
      parser(format, data, callback);
    });
  }

  filter(pkg) {
    return true;
  }

  process(data) {
    throw new Error('Source has no process() implementation');
  }

}

function mergePackages(sets) {
  let packages;

  sets.forEach(set => {
    if (!set) return;

    if (!Array.isArray(set)) {
      if (!packages) packages = {};

      if (Array.isArray(packages))
        throw new Error('Mixed data types not allowed');

      for (let id in set) {
        if (!packages[id]) {
          packages[id] = [];
        }

        packages[id] = packages[id].concat(set[id]);
      }
    } else {
      if (!packages) packages = [];

      if (!Array.isArray(packages))
        throw new Error('Mixed data types not allowed');

      packages = packages.concat(set);
    }
  });

  return packages;
}

export default Source;
