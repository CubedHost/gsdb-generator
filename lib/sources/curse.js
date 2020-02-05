import path from 'path';
import url from 'url';
import {
  map, mapLimit
} from 'async';
import { orderBy } from 'lodash';
import Source from './base';

const CONCURRENCY = 5;
const SLUG_REGEX = /minecraft\/modpacks\/(?:[0-9]+-)?(.*)/;
const VERSION_REGEX = /\(?-?v?((?:(?:[Aa]lpha|[Bb]eta)\s*)?\d+(?:\.[\da-zA-Z.-]+)?)\)?$/;
const CURSEFORGE_URL = 'https://addons-ecs.forgesvc.net/api/v2';

const FileSizes = {
  'KB': 1,
  'MB': 1000,
  'GB': 1000000
};

class CurseSource extends Source {

  constructor(name, options = {}) {
    super(name, options);

    this.broken = {};

    // Create map of included Curse project IDs
    if (options.includes) {
      this.includes = {};
      options.includes.forEach(id => this.includes[id] = id);
    }
  }

  static formatVersion(version) {
    let filename = version.fileName;

    if (/\.(jar|zip)$/.test(filename)) {
      const ext = path.extname(filename);
      filename = path.basename(version.fileName, ext);
    }

    let versionText = filename.match(VERSION_REGEX);
    versionText = versionText ? versionText[1].trim() : version.id;

    return versionText;
  }

  get curseRequestOpts() {
    return {
    };
  }

  fetch(callback) {
    ::this.fetchModpacks(Object.keys(this.includes), callback);
  }

  fetchModpacks(packIds, callback) {
    this.log(`Looking up addon IDs ${packIds.join(',')} in CurseForge API`);

    this.request(`addon`, {
      method: 'post',
      body: JSON.stringify(packIds),
      headers: { 'Content-Type': 'application/json' }
    }, async (err, packs) => {
      for (let packId in packs) {
        packs[packId].files = await ::this.fetchModpackFiles( packs[packId]);
      }

      callback(null, packs);
    });
  }

  async fetchModpackFiles(pack) {
    this.log(`Looking up files for addon ID ${pack.id} in CurseForge API`);

    try {
      let files = await new Promise((res, rej) => {
        this.request(`addon/${pack.id}/files`, { headers: { 'Content-Type': 'application/json' } }, (err, data) => {
          if (err) return rej(err);
          res(data);
        });
      });

      files = files.filter(file => file.isAvailable && file.serverPackFileId);

      if (!files || files.length === 0) {
        this.log(`Pack ${pack.id} does not have a server pack or is not yet available.`);
        return;
      }

      const fileList = {};
      files = files.filter(Boolean);

      mapLimit(files, 10, (file, cb) => {
        this.request(`${CURSEFORGE_URL}/addon/${pack.id}/file/${file.serverPackFileId}/download-url`, { format: 'raw' }, (err, data) => {
          if (err) return cb(null, false);
          file.serverDownload = data;
          cb(null, file);
        });
      }, (err, res) => {
        files = res.filter(Boolean);
      });

      files.forEach(file => fileList[file.id] = file);

      return files;
    } catch (err) {
      this.log(`Failed to fetch addon files for ${pack.id}: ${err}`);
      this.broken[pack.id] = true;
      return;
    }
  }

  process(addons) {
    // Keep track of IDs to avoid duplicates
    const idMap = {};

    addons = addons.map(originalPack => {
      if (!originalPack) return;

      const {
        files
      } = originalPack;
      const hasVersions = files.length > 0;
      if (!hasVersions) return;

      // Generate unique ID for our API
      if (!originalPack.websiteUrl) return;
      const slug = originalPack.websiteUrl.match(SLUG_REGEX)[1];
      let id = `curse-${slug}`;

      // Avoid ID collisions
      if (idMap[id]) id = `${id}-${originalPack.id}`;
      idMap[id] = true;

      // Generate list of versions and determine latest version
      const versionMap = {};
      let latestVersion;

      const hasOnlyBetas = files
        .filter(file => file.releaseType !== 1).length === files.length;

      files.forEach(file => {
        if (!file.serverDownload) {
          this.log(`Skipping version ${file.id} with modpack ${originalPack.id} with no server pack`);
          return;
        }

        const version = CurseSource.formatVersion(file);
        const minecraftVersion = (file.gameVersion || []).sort().pop();

        versionMap[file.id] = {
          id: file.id,
          version,
          minecraftVersion,
          origin: file.serverDownload
        };

        const newerFile = parseInt(latestVersion) < parseInt(file.id);
        const isRelease = file.releaseType === 1;
        const isLatest = newerFile && (hasOnlyBetas || isRelease);

        if (!latestVersion || isLatest) {
          latestVersion = `${file.id}`;
        }
      });

      // Skip packs with no versions available
      if (!Object.keys(versionMap).length) return;

      // Build package data
      const pack = {
        _id: id,
        name: originalPack.name,
        source: this.id,
        versions: versionMap,
        version: latestVersion,
        metadata: {
          curseId: originalPack.id,
          curseSlug: slug
        }
      };

      return pack;
    });

    // Remove undefined/null packages
    addons = addons.filter(_ => _);
    return {
      packages: addons,
      meta: {}
    };
  }
}

export default CurseSource;