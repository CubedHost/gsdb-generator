import url from 'url';
import request from 'request';
import xml from 'xml2js';

class BaseSource {

  constructor(name, url, { _id, format = 'raw' } = {}) {
    this.name = name;
    this.url = url;

    this.format = format;
    this.id = _id;
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
    let { format } = this;

    if (typeof format === 'string') {
      format = format.toLowerCase();
    }

    if (format === 'json') {
      try {
        return callback(null, JSON.parse(data));
      } catch (err) {
        return callback(err);
      }
    }

    if (format === 'xml') {
      return new xml.Parser({ explicitArray: true })
        .parseString(data, (err, result) => {
          callback(err, result);
        });
    }

    if (format === 'raw') {
      return callback(null, data);
    }

    return callback(new Error('Invalid or no format specified'));
  }

  process(data, callback) {
    return callback(new Error('BaseSource has no process() implementation'));
  }

}

export default BaseSource;
