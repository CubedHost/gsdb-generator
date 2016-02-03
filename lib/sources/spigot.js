import url from 'url';
import async from 'async';
import Source from './base';

const HUB_PATH = 'https://hub.spigotmc.org';
const BUILD_CACHE = { };

class SpigotSource extends Source {

  constructor(...params) {
    super(...params);

    this.fork = 'spigot';
  }

  fetch(callback) {
    super.fetch((err, packages) => {
      if (err) return callback(err);

      sortVersions(packages);
      return callback(null, packages);
    });
  }

  fetchRemote(callback) {
    let versions = { };

    this.log('Fetching build information from Spigot Hub, this may take a moment...');

    this.fetchBuildList((err, builds) => {
      if (err) return callback(err);

      async.forEachOf(
        builds,
        mapFilenameToVersion,
        (err) => callback(err, versions)
      );
    });

    let mapFilenameToVersion = (filename, path, next) => {
       if (!path.match(/^[0-9]+\.json$/)) return next();

       this.fetchBuild(path, (err, info) => {
         if (err) return callback(err);

         let { minecraftVersion } = info;

         if (!versions[minecraftVersion]) {
           versions[minecraftVersion] = [];
         }

         info = mapVersionInfo(info);

         if (!info) return next();

         info.name = this.formatVersionName(info);
         versions[minecraftVersion].push(info);

         return next();
       });
    }
  }

  fetchBuildList(callback) {
    this.request(callback);
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
    let { fork } = this;

    let cached = cache(commit, fork);
    if (cached) return callback(null, cached);

    let infoPath = stashPath(fork) + `info.json?at=${commit}&raw`;
    let options = {
      url: infoPath,
      format: 'json',
      followRedirect: false };

    this.request(null, options, (err, buildData) => {
      // Default to MC 1.8 if build data is unavailable
      if (err) buildData = { minecraftVersion: '1.8' }

      return callback(null, cache(commit, fork, buildData));
    });
  }

  process(data) {
    let packages = [ ];

    for (let minecraftVersion in data) {
      let builds = data[minecraftVersion];

      let pkg = {
        _id: `${this.id}-${minecraftVersion}`,
        name: `${this.name} ${minecraftVersion}`,
        source: this.id,
        versions: { },
        metadata: {
          mcversion: minecraftVersion
        }
      };

      // Select last build number as the latest version
      pkg.version = builds[builds.length - 1]['id'];

      builds.forEach((info) => {
        pkg.versions[info.id] = {
          version: info.name,
          minecraftVersion: info.minecraftVersion
        };
      });

      packages.push(pkg);
    }

    return packages;
  }

  formatVersionName(info) {
    let buildNumber = info.id;

    let { commits } = info;
    let spigotCommit = commits.spigot;
    let cbCommit = commits.craftbukkit;

    return `#${buildNumber} (git-${this.name}-${spigotCommit}-${cbCommit})`;
  }

}

function cache(commit, fork, value) {
  if (!BUILD_CACHE[fork]) {
    BUILD_CACHE[fork] = { };
    return;
  }

  // Set cached value if provided, then return it
  if (typeof value !== 'undefined') {
    return (BUILD_CACHE[fork][commit] = value);
  }

  return BUILD_CACHE[fork][commit];
}

function mapVersionInfo(info) {
  if (!info.name.match(/^[0-9]+$/)) return;

  return {
    minecraftVersion: info.minecraftVersion,
    id: info.name,
    commits: {
      spigot: info.refs.Spigot.substring(0, 7),
      craftbukkit: info.refs.CraftBukkit.substring(0, 7)
    }
  };
}

function sortVersions(allVersions) {
  for (let minecraftVersion in allVersions) {
    let versions = allVersions[minecraftVersion];

    // Sort versions by build number
    versions.sort((a, b) => (a.id - b.id));
  }
}

function stashPath(fork) {
  fork = fork.toUpperCase();
  let path = `/stash/projects/${fork}/repos/builddata/browse/`;

  return url.resolve(HUB_PATH, path);
}


export default SpigotSource;
