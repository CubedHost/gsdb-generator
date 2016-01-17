import url from 'url';
import debug from 'debug';
import request from 'request';
import parser from '../parser';

class BaseSource {

  constructor(name, url, { _id, ignore = [ ], format = 'raw' } = {}) {
    this.name = name;
    this.url = url;

    this.id = _id;
    this.ignoredPackages = ignore;
    this.format = format;

    this.log = debug('gen:source:' + this.name);
  }

  scrape(callback) {
    this.fetch((err, data) => {
      if (err) return callback(err);

      if (data === null || typeof data === 'undefined') {
        return callback(new Error('No data available'));
      }

      callback(null, this.process(data));
    });
  }

  fetch(callback) {
    this.request('', null, callback);
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

    if (options === null) {
      options = { };
    }

    options.url = url.resolve(this.url, path);

    request(options, (err, res, body) => {
      if (err) return callback(err);

      if (res.statusCode !== 200) {
        return callback(new Error('Invalid status code: ' + res.statusCode));
      }

      this.preprocess(body, callback);
    });
  }

  preprocess(data, callback) {
    return parser(this.format, data, callback);
  }

  process(data, callback) {
    return callback(new Error('BaseSource has no process() implementation'));
  }

}

export default BaseSource;
