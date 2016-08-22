import path from 'path';
import url from 'url';
import async from 'async';
import debug from 'debug';
import request from 'request';
import parser from '../parser';
import { loadJson } from '../util';

class Source {

  constructor(name, url, options = { }) {
    this.name = name;
    this.url = url;

    this.id = options._id;
    this.ignoredPackages = options.ignore || [];
    this.format = options.format || 'raw';

    this.log = debug('gen:source:' + this.name);
  }

  scrape(callback) {
    this.fetch((err, packages) => {
      if (err) return callback(err);

      return callback(null, this.process(packages));
    });
  }

  fetch(callback) {
    async.parallel([
      ::this.fetchRemote,
      ::this.fetchLocal
    ], (err, results) => {
      if (err) return callback(err);
      return callback(null, mergePackages(results));
    });
  }

  fetchRemote(callback) {
    this.request('', null, callback);
  }

  fetchLocal(callback) {
    let localDataPath = path.join(__dirname, '..', '..', 'data', this.id + '.json');

    loadJson(localDataPath, (err, data) => {
      if (err && err.code === 'ENOENT') return callback(null, { });

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

    request(options, (err, res, body) => {
      if (err) return callback(err);

      if (res.statusCode !== 200) {
        return callback(new Error('Invalid status code: ' + res.statusCode + '; ' + body));
      }

      this.preprocess(body, options, callback);
    });
  }

  preprocess(data, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = { };
    }

    let { format } = this;
    if (options.format) format = options.format;

    return parser(format, data, callback);
  }

  process(data, callback) {
    return callback(new Error('BaseSource has no process() implementation'));
  }

}

function mergePackages(sets) {
  let packages = [ ];

  sets.forEach((set) => {
    if (!set) return;

    for (let id in set) {
      if (!packages[id]) {
        packages[id] = [ ];
      }

      packages[id] = packages[id].concat(set[id]);
    }
  });

  return packages;
}

export default Source;
