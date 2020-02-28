import Source from './base';
import ATLauncher from 'atlauncher-api';

class ATLauncherSource extends Source {
  constructor(name, options) {
    super(name, options);
    this.key = options.key;
    this.url = options.url;
    this.includes = options.includes;
    this.api = ATLauncher({
      base_url: 'https://api.atlauncher.com/'
    });
  }

  filter(pkg) {
    return this.includes.includes(pkg.safeName);
  }

  async fetch() {
    const data = await ::this.request(this.url);
    return data.data;
    /*
    
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
    */
  }

  async process(packs) {
    /*
    
      res[pkg.safeName] = {
        versions: [],
        name: pkg.name
      };

      for (const version of pkg.versions) {
        res[pkg.safeName].versions.push({
          version: version.version,
          minecraftVersion: version.minecraft,
          url: version.__LINK
        });
      }
    */
    packs = packs.map(originalPack => {
      const { safeName } = originalPack;

      if (this.ignoredPackages.indexOf(safeName) !== -1) {
        this.log(`Skipping ignored pack: ${safeName}`);
        return;
      } else if (!originalPack.versions.length) {
        this.log(`Skipping pack without versions: ${safeName}`);
        return;
      } else if (originalPack.type !== 'public') {
        this.log(`Skipping non-public pack: ${safeName}`);
        return;
      }

      const id = 'atlauncher-' + safeName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

      let pattern = 'atl(?:auncher)?-';
      pattern += id.replace(/^atlauncher-/, '');
      pattern += '(?:[.-]([\\d.]+))?\\.jar';
      pattern = new RegExp(pattern);

      let pack = {
        _id: id,
        id: safeName,
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
          version: version.version,
          minecraftVersion: version.minecraft,
          origin: version.__LINK
        })
      );

      return pack;
    });

    return {
      packages: packs,
      meta: {}
    };
  }
}

export default ATLauncherSource;
