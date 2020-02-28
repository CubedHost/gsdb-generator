import url from 'url';
import async from 'async';
import { sortVersions } from '../util';
import Source from './base';

const HUB_PATH = 'https://hub.spigotmc.org/';
const VERSIONS_PATH = `${HUB_PATH}versions/`;
const BUILD_DATA_CACHE = { };

class SpigotSource extends Source {
  project = 'spigot';
  builds = {};

  get stashUrl() {
    let project = this.project.toUpperCase();
    let path = `/stash/projects/${project}/repos/builddata/browse/`;

    return url.resolve(HUB_PATH, path);
  }

  async fetch() {
    try {
      const packages = await super.fetch();

      sortVersions(packages);
      return packages;
    } catch (err) {
      return err;
    }
  }

  async fetchRemote() {
    return await async.series(
      [
        ::this.fetchBuilds,
        ::this.mapBuildData,
        ::this.mapVersions
      ],
      (err) => this.versions
    );
  }

  async fetchBuilds() {
    return await async.series([
      ::this.fetchBuildList,
      ::this.fetchBuildRefs
    ]);
  }

  async fetchBuildList() {
    this.log('Fetching build list from Spigot Hub');

    try {
      const builds = await this.request(VERSIONS_PATH);
      
      let buildList = Object.keys(builds)
        .filter((filename) => filename.match(/^[0-9]+\.json$/))
        .map((filename) => filename.replace(/\.json$/, ''));

      buildList.forEach(build => {
        this.builds[build] = {
          id: build,
          infoUrl: `${VERSIONS_PATH}${build}.json`
        };
      });

      return this.builds;
    } catch (err) {
      return err;
    }
  }

  async fetchBuildRefs() {
    let { builds } = this;
    let buildCount = Object.keys(builds).length;

    this.log(`Fetching refs for ${buildCount} builds`);

    this.builds = builds.map(async (build) => {
      try {
        const info = await this.fetchBuildJson(build.infoUrl);
        if (info) build.refs = info.refs;
      } catch (err) {
        this.log(err);
      }
    });

    return builds
  }

  async fetchBuildJson(jsonUrl) {
    return this.request(jsonUrl, { format: 'json' });
  }

  async mapBuildData() {
    let { builds } = this;

    this.log('Mapping BuildData');

    this.builds = builds.map(async (build) => {
      if (!build.refs) {
        this.log(`Warning: no build data found for build ${i}`);
        return next();
      }

      let commit = build.refs.BuildData;

      try {
        const data = await this.fetchBuildData(commit);

        for (let key in data) {
          build[key] = data[key];
        }
      } catch (err) {
        this.log(err);
      }
    });
  }

  async fetchBuildData(commit) {
    let cached = cacheBuildData(commit);
    if (cached) return cached;

    let infoPath = this.stashUrl + `info.json?at=${commit}&raw`;
    let options = {
      format: 'json',
      followRedirect: false
    };

    try {
      const buildData = await this.request(infoPath, options);

      return cacheBuildData(commit, buildData);
    } catch (err) {
      // Default to MC 1.8 if build data is unavailable
      buildData = { minecraftVersion: '1.8' }
    }

    return buildData;
  }

  async mapVersions() {
    const { builds } = this;
    const versions = {};

    this.log('Mapping Minecraft versions')

    for (const build of builds) {
      const { minecraftVersion } = build;

      if (!versions[minecraftVersion]) {
        versions[minecraftVersion] = [];
      }

      const info = mapVersionInfo(build);

      if (!info) return;

      info.name = this.formatVersionName(info);
      versions[minecraftVersion].push(info);
    }

    this.versions = versions;
  }

  formatVersionName(info) {
    let buildNumber = info.id;

    let { commits } = info;
    let spigotCommit = commits.spigot;
    let cbCommit = commits.craftbukkit;

    let name = `#${buildNumber} (git-${this.name}`;
    if (spigotCommit) name += `-${spigotCommit}`;
    if (cbCommit) name += `-${cbCommit}`;
    name += ')';

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
          id: info.id,
          version: info.name,
          minecraftVersion: info.minecraftVersion
        };
      });

      packages.push(pkg);
    }

    return {
      packages: packages,
      meta: {}
    };
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
  if (!/^[0-9]+$/.test(id)) return;

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
