import Source from './base';

class ATLauncherSource extends Source {

  constructor(name, options) {
    super(name, options);
    this.key = options.key;
  }

  process(data) {
    const packs = [];

    data.forEach((originalPack) => {
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

      originalPack.versions.forEach(
        function(version) {
          pack.versions.push({
            'version': version.version,
            'minecraftVersion': version.minecraft
          });
        }
      );

      packs.push(pack);
    });

    return packs;
  }
}

export default ATLauncherSource;
