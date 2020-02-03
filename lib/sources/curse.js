import path from 'path';
import url from 'url';
import {
  series,
  mapSeries,
  mapValuesLimit,
  mapLimit
} from 'async';
import { orderBy } from 'lodash';
import Source from './base';

const CONCURRENCY = 5;
const SLUG_REGEX = /minecraft\/modpacks\/(?:[0-9]+-)?(.*)/;
const VERSION_REGEX = /\(?-?v?((?:(?:[Aa]lpha|[Bb]eta)\s*)?\d+(?:\.[\da-zA-Z.-]+)?)\)?$/;
const CURSEFORGE_URL = 'https://addons-ecs.forgesvc.net/api/v2';
const CurseLoginAPI = 'https://logins-v1.curseapp.net/login';
const FileSizes = {
  'KB': 1,
  'MB': 1000,
  'GB': 1000000
};

class CurseSource extends Source {
  constructor(name, options = {}) {
    super(name, options);

    this.login = options.login;
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

  async fetch() {
    return await this.fetchModpacks();
  }

  async fetchModpacks() {
    this.log(`Looking up addon IDs ${Object.values(this.includes).join(',')} in CurseForge API`);

    let packs = await this.request(`addon`, {
      method: 'POST',
      body: JSON.stringify(Object.keys(this.includes)),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    packs = packs.map(async pack => {
      try {
        pack.files = await this.fetchModpackFiles(pack);
      } catch (err) {
        this.broken[pack.id] = true;
        this.log(`Error while processing ${pack.id}: ${err}`);
      }
    });

    return packs;
  }

  async fetchModpackFiles(pack) {
    this.log(`Looking up files for addon ID ${pack.id} in CurseForge API`);

    try {
      let files = await this.request(`addon/${pack.id}/files`, this.curseRequestOpts);
      const fileList = {};
      files.forEach(file => fileList[file.id] = file);

      files = files.map(async file => {
        if (!file.isAvailable || !file.serverPackFileId) {
          this.log(`Pack ${pack.id} does not have a server pack or is not yet available.`);
          return;
        }

        file.serverDownload = await this.request(`${CURSEFORGE_URL}/addon/${pack.id}/file/${file.serverPackFileId}/download-url`);
      });

      return files;
    } catch (err) {
      this.log(`Failed to fetch addon files for ${pack.id}: ${err}`);
      this.broken[pack.id] = true;
    }
  }

  async process(addons) {
    // Keep track of IDs to avoid duplicates
    const idMap = {};

    addons = addons.map(async originalPack => {
      const {
        files
      } = originalPack;

      if (!files || files.length === 0) return;

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

      for (const file of files) {
        if (!file.serverDownload) {
          this.log(`Skipping version ${file.id} with no server pack`);
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
      }

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