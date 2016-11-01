import url from 'url';
import async from 'async';
import { sortVersions } from '../util';
import Source from './base';

const HUB_PATH = 'https://hub.spigotmc.org/';
const VERSIONS_PATH = `${HUB_PATH}versions/`;
const BUILD_DATA_CACHE = { };

class SpigotSource extends Source {

  constructor(...params) {
    super(...params);

    this.project = 'spigot';
    this.builds = {};
  }

  get stashUrl() {
    let project = this.project.toUpperCase();
    let path = `/stash/projects/${project}/repos/builddata/browse/`;

    return url.resolve(HUB_PATH, path);
  }

  fetch(callback) {
    super.fetch((err, packages) => {
      if (err) return callback(err);

      sortVersions(packages);
      return callback(null, packages);
    });
  }

  fetchRemote(callback) {
    async.series(
      [
        ::this.fetchBuilds,
        ::this.mapBuildData,
        ::this.mapVersions
      ],
      (err) => callback(err, this.versions)
    );
  }

  fetchBuilds(callback) {
    async.series([
      ::this.fetchBuildList,
      ::this.fetchBuildRefs
    ], callback);
  }

  fetchBuildList(callback) {
    this.log('Fetching build list from Spigot Hub');

    this.request(VERSIONS_PATH, (err, builds) => {
      if (err) return callback(err);

      let buildList = Object.keys(builds)
        .filter((filename) => filename.match(/^[0-9]+\.json$/))
        .map((filename) => filename.replace(/\.json$/, ''));

      buildList.forEach((build) => {
        this.builds[build] = {
          id: build,
          infoUrl: `${VERSIONS_PATH}${build}.json`
        };
      });

      return callback(null, this.builds);
    });
  }

  fetchBuildRefs(callback) {
    let { builds } = this;

    this.log('Fetching refs for each build');

    let mapRefs = (build, i, next) => {
      this.log(`Fetching refs for build ${i}`);

      this.fetchBuildJson(build.infoUrl, (err, info) => {
        if (err) this.log(err);
        if (info) build.refs = info.refs;

        next();
      });
    };

    async.eachOfLimit(builds, 10, mapRefs, callback);
  }

  fetchBuildJson(jsonUrl, callback) {
    this.request(jsonUrl, { format: 'json' }, callback);
  }

  mapBuildData(callback) {
    let { builds } = this;

    this.log('Mapping BuildData');

    let mapEach = (build, i, next) => {
      if (!build.refs) {
        this.log(`Warning: no build data found for build ${i}`);
        return next();
      }

      this.log(`Fetching build data for build ${i}`);

      let commit = build.refs.BuildData;

      this.fetchBuildData(commit, (err, data) => {
        if (err) {
          this.log(err);
          return next();
        }

        for (let key in data) {
          build[key] = data[key];
        }

        return next();
      });
    };

    async.eachOfLimit(builds, 10, mapEach, callback);
  }

  fetchBuildData(commit, callback) {
    let cached = cacheBuildData(commit);
    if (cached) return callback(null, cached);

    let infoPath = this.stashUrl + `info.json?at=${commit}&raw`;
    let options = {
      format: 'json',
      followRedirect: false };

    this.request(infoPath, options, (err, buildData) => {
      // Default to MC 1.8 if build data is unavailable
      if (err) buildData = { minecraftVersion: '1.8' }

      return callback(null, cacheBuildData(commit, buildData));
    });
  }

  mapVersions(callback) {
    let { builds } = this;
    let versions = {};

    this.log('Mapping Minecraft versions')

    let mapVersion = (build, i, next) => {
      let { minecraftVersion } = build;

      if (!versions[minecraftVersion]) {
        versions[minecraftVersion] = [];
      }

      let info = mapVersionInfo(build);

      if (!info) return next();

      info.name = this.formatVersionName(info);
      versions[minecraftVersion].push(info);

      return next();
    }

    async.eachOf(builds, mapVersion, () => {
      this.versions = versions;
      return callback();
    });
  }

  formatVersionName(info) {
    let buildNumber = info.id;

    let { commits } = info;
    let spigotCommit = commits.spigot;
    let cbCommit = commits.craftbukkit;

    let name = `#${buildNumber} (git-${this.name}`;
    if (spigotCommit) name += `-${spigotCommit}`;
    if (cbCommit) name += `-${cbCommit}`;
    name += `)`;

    return name;
  }

  process(data) {
    let packages = [ ];

    for (let minecraftVersion in data) {
      let builds = data[minecraftVersion];

      let id = `${this.id}-${minecraftVersion}`;

      let pattern = new RegExp(
        id.replace(/\./g, '\\.') +
        '(?:[.-]([\\d]+))?\\.jar'
      );

      let pkg = {
        _id: id,
        pattern,
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
}

function cacheBuildData(commit, value) {
  // Set cached value if provided, then return it
  if (typeof value !== 'undefined') {
    return (BUILD_DATA_CACHE[commit] = value);
  }

  return BUILD_DATA_CACHE[commit];
}

function mapVersionInfo(info) {
  if (!info || !info.id || !info.refs) return;

  let id = info.id + '';
  if (!id.match(/^[0-9]+$/)) return;

  let versionInfo = {
    minecraftVersion: info.minecraftVersion,
    id: id,
    commits: {}
  };

  if (info.refs.Spigot) {
    versionInfo.commits.spigot = info.refs.Spigot.substring(0, 7);
  }

  if (info.refs.CraftBukkit) {
    versionInfo.commits.craftbukkit = info.refs.CraftBukkit.substring(0, 7);
  }

  return versionInfo;
}

export default SpigotSource;
