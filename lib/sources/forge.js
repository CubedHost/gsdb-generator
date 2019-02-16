import async from 'async';
import Source from './base';

const mavenCache = { };
const versionData = { };

class ForgeSource extends Source {

  constructor(...params) {
    super(...params);

    this.ignoredPackages = [ 'latest' ];
  }

  fetch(callback) {
    this.getVersionData(callback);
  }

  process(data) {
    let packages = [ ];

    for (let minecraftVersion in data) {
      let builds = data[minecraftVersion];

      let pattern = 'forge-';
      pattern += String(minecraftVersion).replace(/\./g, '\\.');
      pattern += '(?:[.-]((?:[\\d.]+)|latest|recommended))?';
      pattern += '(?:-universal)?\\.jar';
      pattern = new RegExp(pattern);

      let pkg = {
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
          version: versionInfo.version,
          minecraftVersion: versionInfo.mcversion,
          published: versionInfo.timestamp
        });

        if (versionInfo.marker === 'RECOMMENDED') {
          pkg.version = versionInfo.version + '';
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

  getVersionData(callback) {
    if (Object.keys(versionData).length !== 0)
      return callback(null, versionData);

    this.loadVersionData(callback);
  }

  loadVersionData(callback) {
    this.log('Loading all Forge version data');

    this.fetchMinecraftVersions((err, mcVersions) => {

      async.each(mcVersions, (mcVersion, next) => {

        this.fetchVersionData(mcVersion, (err, data) => {
          if (err) {
            this.log(err);
            return next();
          }

          versionData[mcVersion] = data;
          next();
        });

      }, (err) => callback(err, versionData));
    });
  }

  fetchVersionData(mcVersion, callback) {
    this.log('Fetching version information for Minecraft %s', mcVersion);

    this.fetchMavenResource(`index_${mcVersion}.json`, (err, data) => {
        if (err) return callback(err);

        if (!data || !data.md.versions) {
          return callback(new Error('Invalid data'));
        }

        let versions = data.md.versions;
        versions.sort((a, b) => (b.build - a.build));

        return callback(null, versions);
      });
  }

  fetchMinecraftVersions(callback) {
    this.fetchMavenResource('index.json', (err, data) => {
      if (err) return callback(err);

      if (!data || !data.md || !data.md.promos) return callback(new Error('Invalid data'));

      return callback(null, Object.keys(data.md.promos));
    });
  }

  fetchMavenResource(path, callback) {
    if (mavenCache[path]) return callback(null, mavenCache[path]);

    this.request(path, (err, data) => {
      if (err) return callback(err);

      return callback(null, (mavenCache[path] = data));
    });
  }

}

export default ForgeSource;
