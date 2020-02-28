import path from 'path';
import url from 'url';
import async from 'async';
import debug from 'debug';
import request from 'node-fetch';
import parser from '../parser';
import decoder from '../decoder';
import { loadJson } from '../util';

class Source {

  constructor(name, options = { }) {
    this.name = name;

    this.id = options._id;
    this.ignoredPackages = options.ignore || [];
    this.ignoredVersions = options.ignoredVersions || {};
    this.format = options.format || 'raw';
    this.encoding = options.encoding;
    this.options = options;

    this.log = debug('gen:source:' + this.name);
  }

  async scrape() {
    let packages = await ::this.fetch();

    // Filter
    if (Array.isArray(packages)) {
      this.log(`Filtering ${packages.length} items`);
      packages = packages.filter(::this.filter);
      this.log(`Processing ${packages.length} items`);
    }

    // Process
    try {
      packages = await ::this.process(packages);
    } catch (err) {
      console.log(`Error while processing: ${err}`);
      return err;
    }

    return packages;
  }

  async fetch() {
    this.log('Fetching resources');

    const remote = await ::this.fetchRemote();
    const local = await ::this.fetchLocal();
    
    const pkgs = await mergePackages([ remote, local ]);

    return pkgs;
  }

  async fetchRemote() {
    return await ::this.request();
  }

  async fetchLocal() {
    let localDataPath = path.join(__dirname, '..', '..', 'data', this.id + '.json');

    try {
      const json = await loadJson(localDataPath);
      return json;
    } catch (err) {
      if (err && err.code === 'ENOENT') return;

      return err;
    }
  }

  async request(path, options = { }) {
    options.headers = options.headers || {};
    if (!options.headers['User-Agent']) options.headers['User-Agent'] = 'Node.js';

    this.log(options.url);
    options.url = options.url || url.resolve(this.options.url, path || '');

    if (!options.encoding) options.encoding = null;

    try {
      const res = await request(options.url, options);
      let data = await res.text();

      try {
        console.log(data);
        data = JSON.parse(data);
      } catch (err) {
        return data;
      }

      return data;
    } catch (err) {
      this.log(err);
      if (err) return err;

      if (res.statusCode !== 200) {
        err = new Error('Invalid status code: ' + res.statusCode + '; ' + options.url + '; ' + body);
        err.code = res.statusCode;

        return err;
      }
    }
  }

  preprocess(data, options = { }) {
    let { encoding, format } = this;

    if (options.encoding) encoding = options.encoding;
    if (options.format) format = options.format;

    return data;
  }

  filter(pkg) {
    return true;
  }

  async process(data) {
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