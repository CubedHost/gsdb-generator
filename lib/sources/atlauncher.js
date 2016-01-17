import BaseSource from './base';

class ATLauncherSource extends BaseSource {

  constructor(name, url, options) {
    super(name, url, options);
    this.key = options.key;
  }

  fetch(callback) {
    this.request('packs/full/public', callback);
  }

  request(path, callback) {
    let options = {
      headers: { 'API-KEY': this.key }
    };

    super.request(path, options, callback);
  }

  process(data) {
    if (data.error) {
      this.log('Encountered error while processing data: ' + data.message);
      return null;
    }

    data = data.data;
    let packs = [];

    data.forEach((originalPack) => {
      if (this.ignoredPackages.indexOf(originalPack.safeName) !== -1) {
        this.log('Skipping ignored package: %s', originalPack.safeName);
        return;
      }

      let id = originalPack.safeName;
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
          id: originalPack.safeName
        }
      };

      originalPack.versions.forEach(
        function(version) {
          pack.versions.push({
            'version': version.version,
            'minecraftVersion': version.minecraft,
            'published': version.published
          });
        }
      );

      packs.push(pack);
    });

    return packs;
  }
}

export default ATLauncherSource;
