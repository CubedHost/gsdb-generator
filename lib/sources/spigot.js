import path from 'path';
import url from 'url';
import async from 'async';
import Source from './base';

const LOCAL_DATA_PATH = path.resolve(__dirname, '../../data/spigot.json');
const STASH_PATH = '/stash/projects/SPIGOT/repos/builddata/browse/';
const BUILD_DATA = { };

class SpigotSource extends Source {

  constructor(name, url, options) {
    options.localData = LOCAL_DATA_PATH;
    super(name, url, options);
  }

  static sortVersions(allVersions) {
    for (let minecraftVersion in allVersions) {
      let versions = allVersions[minecraftVersion];

      // Sort versions by build number
      versions.sort((a, b) => (a.id - b.id));
    }
  }

  fetch(callback) {
    super.fetch((err, packages) => {
      if (err) return callback(err);

      SpigotSource.sortVersions(packages);
      return callback(null, packages);
    });
  }

  fetchRemote(callback) {
    let versions = { };

    this.log('Fetching build information from Spigot Hub, this may take a moment...');

    this.request((err, anchorList) => {
      if (err) return callback(err);

      async.forEachOf(
        anchorList,
        mapAnchorToVersion,
        (err) => callback(err, versions)
      );
    });

    let mapAnchorToVersion = (filename, path, next) => {
      if (!path.match(/^[0-9]+\.json$/)) return next();

      this.fetchBuild(path, (err, info) => {
        if (err) return next(err);
        if (!info.name.match(/^[0-9]+$/)) return next();

        let { minecraftVersion } = info;
        let buildNumber = info.name;

        let spigotCommit = info.refs.Spigot.substring(0, 7);
        let cbCommit = info.refs.CraftBukkit.substring(0, 7);

        if (!versions[minecraftVersion]) {
          versions[minecraftVersion] = [ ];
        }

        versions[minecraftVersion].push({
          id: buildNumber,
          name: `#${buildNumber} (git-Spigot-${spigotCommit}-${cbCommit})`,
          minecraftVersion
        });

        next();
      });
    }
  }

  fetchBuild(path, callback) {
    this.request(path, { format: 'json' }, (err, info) => {
      if (err) return callback(err);

      let commit = info.refs.BuildData;

      this.fetchBuildData(commit, (err, data) => {
        if (err) return callback(err);

        for (let key in data) {
          info[key] = data[key];
        }

        return callback(null, info);
      });
    });
  }

  fetchBuildData(commit, callback) {
    if (BUILD_DATA[commit]) return callback(null, BUILD_DATA[commit]);

    let path = url.resolve(this.url, STASH_PATH) + `info.json?at=${commit}&raw`;

    this.request(path, { format: 'json', followRedirect: false }, (err, buildData) => {
      // Default to MC 1.8 if build data is unavailable
      if (err) buildData = { minecraftVersion: '1.8' }

      BUILD_DATA[commit] = buildData;

      return callback(null, buildData);
    });
  }

  process(data) {
    let packages = [ ];

    for (let minecraftVersion in data) {
      let versions = data[minecraftVersion];

      let pkg = {
        _id: `${this.id}-${minecraftVersion}`,
        name: `Spigot ${minecraftVersion}`,
        source: this.id,
        versions: { },
        metadata: {
          mcversion: minecraftVersion
        }
      };

      // Select last build number as the latest version
      pkg.version = versions[versions.length - 1]['id'];

      versions.forEach((info) => {
        pkg.versions[info.id] = {
          version: info.name,
          minecraftVersion: info.minecraftVersion
        };
      });

      packages.push(pkg);
    }

    return packages;
  }

}

export default SpigotSource;
