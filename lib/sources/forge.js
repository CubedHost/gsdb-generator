import async from 'async';
import Source from './base';

class ForgeSource extends Source {
  ignoredPackages = [ 'latest' ];

  async fetch() {
    return await this.fetchVersionData();
  }

  async process(data) {
    const packages = [ ];

    for (const minecraftVersion in data) {
      const builds = data[minecraftVersion];

      let pattern = 'forge-';
      pattern += String(minecraftVersion).replace(/\./g, '\\.');
      pattern += '(?:[.-]((?:[\\d.]+)|latest|recommended))?';
      pattern += '(?:-universal)?\\.jar';
      pattern = new RegExp(pattern);

      const pkg = {
        _id: `${this.id}-${minecraftVersion}`,
        name: `${this.name} ${minecraftVersion}`,
        visibility: 'public',
        source: this.id,
        versions: [],
        metadata: {
          mcversion: minecraftVersion
        },
        pattern
      };

      builds.forEach((versionInfo) => {
        pkg.versions.push({
          id: versionInfo.version,
          minecraftVersion,
          version: versionInfo.version
          // published: versionInfo.timestamp
        });

        if (versionInfo.recommended) {
          pkg.version = `${versionInfo.version}`;
        }
      });

      if (!pkg.version) {
        pkg.version = builds[builds.length - 1].version;
      }

      packages.push(pkg);
    }

    return {
      packages: packages,
      meta: {}
    };
  }

  async fetchVersionData() {
    this.log('Loading all library version data');

    try {
      const versions = await this.fetchMavenVersions();
      const promos = await this.fetchPromotions();

      const mcVersions = {};
      versions.forEach(ver => {
        const [ mcVersion, version ] = ver.split('-');

        if (!(mcVersion in mcVersions)) {
          mcVersions[mcVersion] = [];
        }

        mcVersions[mcVersion].push({
          version,
          recommended: promos[mcVersion]
            && promos[mcVersion].recommended === version
        });
      });

      return mcVersions;
    } catch (err) {
      return err;
    }
  }

  async fetchMavenVersions() {
    this.log('Fetching Maven metadata for Forge');

    try {
      const parsedBody = await this.request('maven-metadata.json');

      const metadata = parsedBody.metadata;

      if (!parsedBody.metadata) {
        return new Error('Forge Maven metadata missing "metadata"');
      }

      const [ versioning ]  = metadata.versioning;
      if (!versioning) {
        return new Error('Forge Maven metadata missing "versioning"');
      }

      const [ versions ] = versioning.versions;
      if (!versions) {
        return new Error('Forge Maven metadata missing "versions"');
      }

      return versions.version;
    } catch (err) {
      return err;
    }
  }

  async fetchPromotions() {
    this.log('Fetching promotions for Forge');

    try {
      const data = await this.request('promotions.json');
      const mcVersions = {};

      const promos = data.promos;
      for (const promoKey in promos) {
        const promo = promos[promoKey];

        const promoTypeMatch = promoKey.match(/-(latest|recommended)$/);
        if (!promoTypeMatch) continue;

        const [ , promoType ] = promoTypeMatch;
        const mcVersion = promo.mcversion;
        const { version } = promo;

        // Init if empty
        if (!mcVersions[mcVersion]) {
          mcVersions[mcVersion] = {};
        }

        mcVersions[mcVersion][promoType] = version;
      }

      return mcVersions;
    } catch (err) {
      return err;
    }
  }

}

export default ForgeSource;
