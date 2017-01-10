import path from 'path';
import { eachOfSeries } from 'async';
import Source from './base';

const VERSION_REGEX = /\(?-?v?((?:(?:[Aa]lpha|[Bb]eta)\s*)?\d+(?:\.[\da-zA-Z.-]+)?)\)?$/;

class CurseSource extends Source {

  constructor(name, url, options = {}) {
    super(name, url, options);

    // Create map of included Curse project IDs
    if (options.includes) {
      this.includes = {};
      options.includes.forEach(id => this.includes[id] = true);
    }
  }

  scrape(callback) {
    super.scrape((err, packages) => {
      if (err) return callback(err);

      this.scrapeOrigins(packages, callback);
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
      let slug = originalPack.WebSiteURL.match(/[0-9]+-(.*)/)[1];
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
        let filename = path.basename(version.FileName, path.extname(version.FileName));
        let versionText = filename.match(VERSION_REGEX);
        versionText = versionText ? versionText[1].trim() : version.Id;

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

  scrapeOrigins(packages, callback) {
    // Iterate through packages
    eachOfSeries(
      packages,
      (pkg, key, next) =>
        // Iterate through each version of each packge
        eachOfSeries(
          pkg.versions,
          (version, key, nextVersion) =>
            // Scrape origin URL for each version
            this.scrapeOrigin(pkg.metadata.curseSlug, version, key, nextVersion),
          next
        ),
      callback
    );
  }

  scrapeOrigin(slug, version, key, callback) {
    let url = `https://minecraft.curseforge.com/projects/${slug}/files/${key}`;
    let options = {
      encoding: 'utf8',
      format: 'html'
    };

    this.request(url, options, (err, $) => {
      let anchor = $('.details-additional-files tbody a');
      let filename = anchor.text();

      if (filename.match(/.*server.*\.zip/i)) {
        let href = anchor.attr('href');
        version.origin = `https://minecraft.curseforge.com${href}`;
      }

      callback();
    });
  }

}

export default CurseSource;
