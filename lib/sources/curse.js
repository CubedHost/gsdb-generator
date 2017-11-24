import path from 'path';
import url from 'url';
import { series, eachOfSeries, eachOfLimit } from 'async';
import Source from './base';

const CONCURRENCY = 5;
const SLUG_REGEX = /minecraft\/modpacks\/(?:[0-9]+-)?(.*)/;
const VERSION_REGEX = /\(?-?v?((?:(?:[Aa]lpha|[Bb]eta)\s*)?\d+(?:\.[\da-zA-Z.-]+)?)\)?$/;
const CURSEFORGE_URL = 'https://minecraft.curseforge.com';

class CurseSource extends Source {

  constructor(name, url, options = {}) {
    super(name, url, options);

    // Create map of included Curse project IDs
    if (options.includes) {
      this.includes = {};
      options.includes.forEach(id => this.includes[id] = true);
    }
  }

  static formatVersion(version) {
    let filename = version.FileName;

    if (/\.(jar|zip)$/.test(filename)) {
      const ext = path.extname(filename);
      filename = path.basename(version.FileName, ext);
    }
    
    let versionText = filename.match(VERSION_REGEX);
    versionText = versionText ? versionText[1].trim() : version.Id;

    return versionText;
  }

  scrape(callback) {
    super.scrape((err, packages) => {
      if (err) return callback(err);

      series([
        next => this.scrapeVersions(packages, next),
        next => this.scrapeOrigins(packages, next)
      ], err => callback(err, packages));
    });
  }

  fetchRemote(callback) {
    super.fetchRemote((err, data) => {
      return callback(err, !err && data ? data.data : []);
    });
  }

  filter(pkg) {
    // Only take modpacks, not texture packs, worlds, etc.
    if (pkg.CategorySection.Name !== 'Modpacks') return false;

    // Skip FTB packs
    if (pkg.Name.match('FTB')) return false;

    // Skip pack if Curse project ID whitelisting is enabled and this
    // project's ID was not included in the list.
    let { includes } = this;
    if (includes && !includes[parseInt(pkg.Id)]) return false;

    return true;
  }

  process(addons) {
    // Keep track of IDs to avoid duplicates
    let idMap = {};

    addons = addons.map((originalPack) => {
      let versions = originalPack.LatestFiles;
      let hasVersions = versions.length > 0;
      if (!hasVersions) return;

      // Generate unique ID for our API
      if (!originalPack.WebSiteURL) return;
      let slug = originalPack.WebSiteURL.match(SLUG_REGEX)[1];
      let id = `curse-${slug}`;

      // Avoid ID collisions
      if (idMap[id]) id = `${id}-${originalPack.Id}`;
      idMap[id] = true;

      // Generate a JAR file regex pattern based on the ID
      let pattern = new RegExp(`${id}(?:[.-]([\\d.]+))?\\.jar`);

      // Generate list of versions and determine latest version
      let versionMap = {};
      let latestVersion;

      versions.forEach(version => {
        const versionText = CurseSource.formatVersion(version);

        versionMap[version.Id] = {
          version: versionText,
          minecraftVersion: version.GameVersion[0]
        };

        if (latestVersion < version.Id && version.ReleaseType === 1)
          latestVersion = version.Id;
      });

      // Skip packs with no versions available
      if (!Object.keys(versionMap).length) return;

      // If no latest version detected, use the first available
      if (!latestVersion)
        latestVersion = versions[0].Id;

      // Build package data
      let pack = {
        _id: id,
        name: originalPack.Name,
        source: this.id,
        versions: versionMap,
        version: latestVersion,
        pattern,
        metadata: {
          curseId: originalPack.Id,
          curseSlug: slug
        }
      };

      return pack;
    });

    // Remove undefined/null packages
    addons = addons.filter(pack => pack ? true : false);

    return addons;
  }

  scrapeVersions(packages, callback) {
    // Iterate through packages
    eachOfSeries(packages, ::this.scrapeVersionsForPackage, callback);
  }

  scrapeVersionsForPackage(pkg, key, callback) {
    const { metadata } = pkg;
    const { curseSlug } = metadata;

    this.log(`Scraping versions for ${curseSlug}`);

    const fileListUrl  = `${CURSEFORGE_URL}/projects/${curseSlug}/files`;
    const options = {
      encoding: 'utf8',
      format: 'html'
    };

    // List all additional files for project
    // 
    this.request(fileListUrl, options, (err, $) => {
      if (err) return callback(err);

      const versionList = $('.project-file-list-item');
      if (!versionList) return callback();

      versionList.each((i, packVersion) => {
        const hasServerPack = $(packVersion).find('.more-files-tag');
        if (!hasServerPack) return;

        const versionLink = $(packVersion)
          .find('[data-action=modpack-file-link]');
        if (!versionLink) return;

        const versionId = $(versionLink).attr('href').split('/').pop();
        const versionObject = {
          'Id': versionId,
          'FileName': $(versionLink).text()
        };
        const versionText = CurseSource.formatVersion(versionObject);

        // Skip already detected version
        if (pkg.versions[versionId]) {
          this.log(`Skipping version ${versionId}`);
          return;
        }

        const gameVersion = $(packVersion).find('.version-label').text();
        const version = {
          version: versionText,
          minecraftVersion: gameVersion
        };

        pkg.versions[versionId] = version;
      });

      callback();
    })
  }

  scrapeOrigins(packages, callback) {
    // Iterate through packages
    eachOfSeries(
      packages,
      (pkg, key, next) => {
        const slug = pkg.metadata.curseSlug;
        this.log(`Scraping origin URLs for ${slug}`);

        // Iterate through each version of each packge
        eachOfLimit(
          pkg.versions,
          CONCURRENCY,
          (version, key, nextVersion) =>
            // Scrape origin URL for each version
            this.scrapeOrigin(slug, version, key, nextVersion),
          next
        )
      },
      (err) => callback(err, packages)
    );
  }

  scrapeOrigin(slug, version, key, callback) {
    this.log(`Scraping origin URL for ${slug} ${version.version}`);

    let fileUrl = `${CURSEFORGE_URL}/projects/${slug}/files/${key}`;
    let options = {
      encoding: 'utf8',
      format: 'html'
    };

    // Get list of additional files for version
    this.request(fileUrl, options, (err, $) => {
      if (err) return callback(err);

      let anchors = $('.project-file-name-container a');

      let files = [];
      anchors.each((i, e) => files.push($(e).attr('href')));

      // Iterate over additional files and check filenames
      eachOfSeries(files, (file, key, next) => {
        this.log(`Fetching additional file ${file}`);
        let addFileUrl = url.resolve(CURSEFORGE_URL, file);

        // Fetch details page for specific file
        this.request(addFileUrl, options, (err, $, raw) => {
          if (err) return next(err);

          let href = $('.project-file-download-button-large a').attr('href');
          let filename = $('.details-info li .info-data').first().text();

          if (filename.match(/.*[sS]erver.*\.zip/i)) {
            version.origin = `${CURSEFORGE_URL}${href}`;
          }

          next();
        });
      }, callback);
    });
  }

}

export default CurseSource;
