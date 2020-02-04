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
const CURSEFORGE_URL = 'https://minecraft.curseforge.com';
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
      headers: {
        'AuthenticationToken': this.loginToken
      }
    };
  }

  fetch(callback) {
    series([
      next => this.curseLogin(next),
      next => this.fetchModpacks(next)
    ], (err, results) => {
      callback(err, err ? null : results[1]);
    })
  }

  /**
   * Performs Curse login using configured credentials and stores session token.
   */
  curseLogin(callback) {
    const {
      login
    } = this;

    // Check for creds
    if (!login || !login.username || !login.password) {
      return callback(new Error('No CurseForge login credentials provided'));
    }

    const requestBody = {
      Username: login.username,
      Password: login.password
    };

    const requestOptions = {
      method: 'post',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json'
      }
    };

    /*this.request(CurseLoginAPI, requestOptions, (err, res) => {
      if (err) {
        return callback(new Error(`CurseForge login failed: ${err}`));
      }

      // Check for token
      if (!res || !res.Session || !res.Session.Token) {
        return callback(new Error(`Invalid CurseForge login response: ${res}`))
      }

      this.loginToken = res.Session.Token;
      this.log('Successfully logged into CurseForge');

      callback();
    });*/
    callback();
  }

  fetchModpacks(callback) {
    mapLimit(
      this.includes,
      CONCURRENCY,
      (id, next) => this.fetchModpack(id, next),
      callback
    );
  }

  fetchModpack(id, callback) {
    this.log(`Looking up addon ID ${id} in CurseForge API`);

    this.request(`addon/${id}`, this.curseRequestOpts, (err, pack) => {
      if (err) {
        this.log(`Failed to fetch addon for ${id}: ${err}`);
        this.broken[id] = true;
        return callback();
      }

      this.fetchModpackFiles(pack, callback);
    });
  }

  fetchModpackFiles(pack, callback) {
    this.log(`Looking up files for addon ID ${pack.id} in CurseForge API`);

    this.request(`addon/${pack.id}/files`, this.curseRequestOpts, (err, files) => {
      if (err) {
        this.log(`Failed to fetch addon files for ${pack.id}: ${err}`);
        this.broken[pack.id] = true;
        return callback();
      }

      const fileList = {};
      files.forEach(file => fileList[file.id] = file);

      mapValuesLimit(
        fileList,
        CONCURRENCY,
        (_, id, next) => this.scrapeOrigin(pack, id, next),
        (_, withOrigins) => {
          pack.files = files.map(file => {
            file.serverDownload = withOrigins[file.id];
            return file;
          });

          return callback(null, pack);
        }
      );
    });
  }

  scrapeOrigin(pack, file, callback) {
    const curseName = pack.name;
    const curseID = pack.id;

    this.log(`Scraping origin URL for ${curseName} ${file}`);

    const fileUrl = `${CURSEFORGE_URL}/projects/${curseID}/files/${file}`;
    const options = {
      encoding: 'utf8',
      format: 'html'
    };

    // Get list of additional files for version
    this.request(fileUrl, options, (err, $) => {
      if (err) {
        this.broken[curseID] = true;
        this.log(`Error while scraping ${fileUrl}: ${err}`);
        return callback();
      }

      const anchors = $('.project-file-name-container a');

      const files = [];
      anchors.each((_, e) => files.push($(e).attr('href')));

      // Iterate over additional files and check filenames
      mapSeries(files, (addFile, next) => {
        this.log(`Fetching additional file ${file}`);
        const addFileUrl = url.resolve(CURSEFORGE_URL, addFile);

        // Fetch details page for specific file
        this.request(addFileUrl, options, (err, $) => {
          if (err) {
            this.log(`Error while scraping ${addFileUrl}, skipping: ${err}`);
            return next();
          }

          const href = $('.project-file-download-button-large a').attr('href');
          const filename = $('.details-info li .info-data').first().text();
          
          let fileSize = $('.details-info li .info-data').eq(3).text();
          const [ fileSizeValue, fileSizeUnit ] = fileSize.split(' ');
          fileSize = parseFloat(fileSizeValue) * FileSizes[fileSizeUnit];

          if (filename.match(/.*[sS]erver.*\.zip/i)) {
            const origin = `${CURSEFORGE_URL}${href}`;
            return next(null, {
              origin,
              fileSize
            });
          }

          next();
        });
      }, (_, origins) => {
        // Does not return an error, swallows and marks it broken

        // Filter out nulls and sort by filesize
        origins = origins.filter(_ => _);
        origins = orderBy(origins, ['fileSize'])

        // Select the first or largest file (if multiple)
        const origin = origins.length > 0 ? origins.pop().origin : null;

        return callback(null, origin);
      });
    });
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