import path from 'path';
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

  fetchRemote(callback) {
    super.fetchRemote((err, data) => {
      return callback(err, !err && data ? data.data : []);
    });
  }

  filter(pkg) {
    // Only take modpacks, not texture packs, worlds, etc.
    return pkg.CategorySection.Name === 'Modpacks';
  }

  process(addons) {
    let { includes } = this;

    // Keep track of IDs to avoid duplicates
    let idMap = {};

    addons = addons.map((originalPack) => {
      let versions = originalPack.LatestFiles;
      let hasVersions = versions.length > 0;
      if (!hasVersions) return;

      // Skip FTB packs
      if (originalPack.Name.match('FTB')) {
        this.log(`Skipping FTB match: ${originalPack.Name}`);
        return;
      }

      // Skip pack if Curse project ID whitelisting is enabled and this
      // project's ID was not included in the list.
      originalPack.Id = parseInt(originalPack.Id);
      if (includes && !includes[originalPack.Id]) return;

      // Generate unique ID for our API
      let id = originalPack.Name
        .trim()
        .replace(/[mM]odpack$/g, '')
        .replace(/W\.?I\.?P\.?/g, '')
        .replace(/([a-z])_([A-Z])/g, '$1-$2')
        .replace(/_(\d+)_(\d+)_(\d+)$/g, '-$1.$2.$3')
        .replace(/_(\d+)_(\d+)$/g, '-$1.$2')
        .replace(/_(\d)(\d)$/g, '-$1.$2')
        .replace(/([a-z]{3,})([A-Z])/g, '$1-$2')
        .replace(/([a-z])_(\d+)/g, '$1$2')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/[^a-zA-Z0-9.\-]*/g, '')
        .replace(/-$/g, '')
        .toLowerCase();

      id = `curse-${id}`;

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
          minecraftVersion: version.GameVersion[0],
          origin: version.DownloadURL
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
          curseId: originalPack.Id
        }
      };

      return pack;
    });

    // Remove undefined/null packages
    addons = addons.filter(pack => pack ? true : false);

    return addons;
  }

}

export default CurseSource;
