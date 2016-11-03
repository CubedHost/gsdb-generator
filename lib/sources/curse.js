import path from 'path';
import Source from './base';

const VERSION_REGEX = /\(?-?v?((?:(?:[Aa]lpha|[Bb]eta)\s*)?\d+(?:\.[\da-zA-Z.-]+)?)\)?$/;

class CurseSource extends Source {

  constructor(name, url, options) {
    super(name, url, options);
  }

  process(data) {
    let addons = data.data;
    let modpacks = addons.filter(
      addon => addon.CategorySection.Name === 'Modpacks'
    );

    let idMap = {};

    modpacks = modpacks.map((originalPack) => {
      let versions = originalPack.LatestFiles;
      let hasVersions = versions.length > 0;
      if (!hasVersions) return;

      // skip FTB packs
      if (originalPack.Name.match('FTB')) return;

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

      if (idMap[id]) id = `${id}-${originalPack.Id}`;

      let pattern = new RegExp(`${id}(?:[.-]([\\d.]+))?\\.jar`);

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

      if (!latestVersion)
        latestVersion = versions[0].Id;

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

    modpacks = modpacks.filter(pack => pack ? true : false);

    return modpacks;
  }

}

export default CurseSource;
