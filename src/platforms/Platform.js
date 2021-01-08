import path from 'path';
import url from 'url';
import debug from 'debug';
import request from 'node-fetch';
import { loadJson } from '../util';
import GameVersion from '../models/GameVersion';
import Cache from '../models/Cache';

class Platform {
  _cache = {};

  constructor(name, options = { config: [] }) {
    for (const key in options) {
      this[key] = options[key];
    }

    if (options.config) {
      for (const item of options.config) {
        this[item.key] = item.value;
        try {
          this[item.key] = JSON.parse(item.value);
        } catch (err) {
          this[item.key] = item.value;
        }
      }
    }

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
      throw err;
    }

    return packages;
  }

  async findGameVersion(source, version) {
    if (typeof this._cache[`${source.id}_${version}`] !== 'undefined') {
      return this._cache[`${source.id}_${version}`];
    }

    let gameVersion = await GameVersion.query()
      .where({
        game_id: source.game.id,
        version
      })
      .first();

    if (!gameVersion) {
      this.log(`Discovered new version of ${source.name}: ${version}`);
      gameVersion = await GameVersion.query().insertAndFetch({
        game_id: source.game.id,
        version
      });
    }

    this._cache[`${source.id}_${version}`] = gameVersion;

    return gameVersion;
  }

  async fetch() {
    this.log('Fetching resources');
    try {
      return mergePackages([ await ::this.fetchRemote(), await ::this.fetchLocal() ]);
    } catch (err) {
      this.log(err);
    }
  }

  async fetchRemote() {
    return ::this.request();
  }

  async getFromCache(key) {
    const localCacheCheck = this._cache[`${this.id}_${key}`];
    if (typeof localCacheCheck !== 'undefined') return localCacheCheck;

    const cacheCheck = await Cache.query().findById(`${this.id}_${key}`);

    if (cacheCheck) {
      try {
        this._cache[key] = JSON.parse(cacheCheck.value);
      } catch (err) {
        this._cache[key] = cacheCheck.value;
      }

      return this._cache[key];
    }

    return false;
  }

  async putCache(key, value) {
    this._cache[key] = value;

    return Cache.query().insertAndFetch({
      key: `${this.id}_${key}`,
      value: JSON.stringify(value)
    });
  }

  async fetchLocal() {
    let localDataPath = path.join(__dirname, '..', '..', 'data', this.id + '.json');

    try {
      const json = await loadJson(localDataPath);
      return json;
    } catch (err) {
      if (err && err.code === 'ENOENT') return;

      throw err;
    }
  }

  async request(path, options = { }) {
    options.headers = options.headers || {};
    if (!options.headers['User-Agent']) options.headers['User-Agent'] = 'Node.js';

    const addr = options.url || url.resolve(this.url, path || '');

    if (!options.encoding) options.encoding = null;

    try {
      this.log(`Requesting: ${addr}`);
      const res = await request(addr, options);
      let data = await res.text();

      try {
        data = JSON.parse(data);
      } catch (err) {
        return data;
      }

      return data;
    } catch (err) {
      this.log(err);
      if (err) throw err;

      if (res.statusCode !== 200) {
        err = new Error('Invalid status code: ' + res.statusCode + '; ' + options.url + '; ' + body);
        err.code = res.statusCode;

        throw err;
      }
    }
  }

  preprocess(data, options = { }) {
    if (options.encoding) this.encoding = options.encoding;
    if (options.format) this.format = options.format;

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

  for (const set of sets) {
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
  }

  return packages;
}

export default Platform;