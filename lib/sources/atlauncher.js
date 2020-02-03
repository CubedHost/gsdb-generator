import Source from './base';
import ATLauncher from 'atlauncher-api';

class ATLauncherSource extends Source {
  constructor(name, options) {
    super(name, options);
    this.key = options.key;
    this.api = ATLauncher({
      base_url: 'https://api.atlauncher.com/'
    });
  }

  async process(packs) {
    data.map(async originalPack => {
      const safeName = originalPack.name.replace(/[^a-zA-Z0-9]/g, '');

      if (this.ignoredPackages.indexOf(safeName) !== -1) {
        this.log(`Skipping ignored pack: ${safeName}`);
        return;
      } else if (!originalPack.createServer) {
        this.log(`Skipping pack without server: ${safeName}`);
        return;
      } else if (!originalPack.versions.length) {
        this.log(`Skipping pack without versions: ${safeName}`);
        return;
      } else if (originalPack.type !== 'public') {
        this.log(`Skipping non-public pack: ${safeName}`);
        return;
      }

      let id = safeName;
      id = 'atlauncher-' + id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

      let pattern = 'atl(?:auncher)?-';
      pattern += id.replace(/^atlauncher-/, '');
      pattern += '(?:[.-]([\\d.]+))?\\.jar';
      pattern = new RegExp(pattern);

      let pack = {
        _id: id,
        name: originalPack.name,
        visibility: originalPack.type,
        source: this.id,
        versions: [],
        version: originalPack.versions[0].version,
        pattern: pattern,
        metadata: {
          id: safeName
        }
      };

      pack.versions.map(version => 
        pack.versions.push({
          id: version.version,
          'version': version.version,
          'minecraftVersion': version.minecraft
        })
      );
    });

    return {
      packages: packs,
      meta: {}
    };
  }
}

export default ATLauncherSource;
