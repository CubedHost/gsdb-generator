import async from 'async';
import Source from './base';

class ForgeSource extends Source {

  constructor(...params) {
    super(...params);

    this.ignoredPackages = [ 'latest' ];
  }

  fetch(callback) {
    this.fetchVersionData(callback);
  }

  process(data) {
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

  fetchVersionData(callback) {
    this.log('Loading all library version data');

    this.fetchMavenVersions((err, versions) => {
      if (err) return callback(err);

      this.fetchPromotions((err, promos) => {
        if (err) return callback(err);

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
        })

        return callback(null, mcVersions);
      });
    });
  }

  fetchMavenVersions(callback) {
    this.log('Fetching Maven metadata for Forge');

    this.request('maven-metadata.xml', { format: 'xml' }, (err, parsedBody) => {
      if (err) return callback(err);

      const metadata = parsedBody.metadata;
      if (!parsedBody.metadata) {
        return callback(new Error('Forge Maven metadata missing "metadata"'));
      }

      const [ versioning ]  = metadata.versioning;
      if (!versioning) {
        return callback(new Error('Forge Maven metadata missing "versioning"'));
      }

      const [ versions ] = versioning.versions;
      if (!versions) {
        return callback(new Error('Forge Maven metadata missing "versions"'));
      }

      return callback(null, versions.version);
    });
  }

  fetchPromotions(callback) {
    this.log('Fetching promotions for Forge');

    this.request('promotions.json', (err, data) => {
      if (err) return callback(err);

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

      return callback(null, mcVersions);
    });
  }

}

export default ForgeSource;
