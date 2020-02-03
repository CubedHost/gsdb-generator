import async from 'async';
import Source from './base';
import { matchAll, sortVersions } from '../util';

const BUILD_NUMBER_REGEX = /#[0-9]+/g;
const OLDEST_ENTRY_REGEX = /page-entry-oldest="(-?[0-9]+)"/g;

export default class JenkinsSource extends Source {
  builds = {};
  packages = {};

  async fetchRemote() {
    async.series(
      [
        ::this.getBuildList,
        ::this.mapJarFilenames,
        ::this.mapMinecraftVersions,
        (done) => sortVersions(this.packages, done)
      ]
    );

    return this.packages;
  }

  async getBuildList() {
    this.log('Fetching build list from Jenkins');

    try {
      const builds = await this.fetchFullBuildHistory();
      builds.forEach((build) => {
        this.builds[build] = {
          id: build,
          name: `#${build}`
        };
      });

      const buildCount = Object.keys(this.builds).length;
      this.log(`Found ${buildCount} builds`);

      return builds;
    } catch (err) {
      return err;
    }
  }

  getMinecraftVersionFromPom(pom) {
    let project = pom.project;
    if (!project) return null;

    let properties = project.properties;
    if (!properties) return null;
    properties = properties[0];

    return properties['minecraft.version'][0];
  }

  mapMinecraftVersions(callback) {
    this.log('Fetching Minecraft versions via pom');

    async.eachOfLimit(this.builds, 10, ::this.mapMinecraftVersion, callback);
  }

  mapMinecraftVersion(build, id, callback) {
    this.fetchPom(id, (err, pom) => {
      if (err) this.log(err);
      if (!pom) return callback();

      let minecraftVersion = this.getMinecraftVersionFromPom(pom);
      if (!minecraftVersion) return callback();

      build.minecraftVersion = minecraftVersion;

      if (!this.packages[minecraftVersion]) {
        this.packages[minecraftVersion] = [];
      }

      this.packages[minecraftVersion].push(build);

      callback();
    });
  }

  mapJarFilenames(callback) {
    let mapJar = (build, id, done) => {
      this.fetchJarFilename(id, (err, filename) => {
        if (err) this.log(err);
        if (filename) build.jar = filename;
        return done();
      });
    };

    this.log('Mapping origin jar filenames from Jenkins artifacts');

    async.eachOfLimit(this.builds, 10, mapJar, (err) => callback(err));
  }

  async fetchFullBuildHistory() {
    let buildList = [];
    let position;

    let options =  { format: 'json' };

    try {
      const projectInfo = await this.request('api/json', options);

      if (!projectInfo.firstBuild) {
        return callback(null, []);
      }

      // identify first (oldest) build number
      let firstBuild = projectInfo.firstBuild.number;

      let hasReachedEnd = () => (buildList[buildList.length - 1] === firstBuild);

      let fetchNextBuilds = (done) => {
        this.fetchBuildHistory(position, (err, builds, oldestEntry) => {
          if (err) return done(err);

          buildList = buildList.concat(builds);
          position = oldestEntry;

          done();
        });
      }

      return await async.until(hasReachedEnd, fetchNextBuilds);
    } catch (err) {
      return err;
    }
  }

  async fetchBuildHistory(olderThan = undefined) {
    let url = 'buildHistory/';
    if (olderThan) url += '?older-than=' + olderThan;

    let options = { format: 'raw' };

    try {
      const data = await this.request(url, options);
      let builds = matchAll(data, new RegExp(BUILD_NUMBER_REGEX));
      builds = builds.map((matches) => parseInt(matches[0].substring(1)));

      let oldestEntry = new RegExp(OLDEST_ENTRY_REGEX).exec(data);
      if (oldestEntry !== null) {
        oldestEntry = oldestEntry[1];
      }

      return { builds, oldestEntry };
    } catch (err) {
      return err;
    }
  }

  async fetchPom(build) {
    const module = this.getModule(build);
    let path = `${build}/${module}`;
    
    this.log(`Fetching pom for build: ${build}`);

    try {
      const moduleBuild = await this.request(`${path}/api/json`);

      const { artifacts } = moduleBuild;
      const pomArtifact = artifacts.filter(
        (artifact) => artifact.fileName.match(this.pomRegex)
      )[0];

      if (!pomArtifact) {
        this.log(`No POM found for build ${build}`);
        return callback();
      }

      path += `/artifact/${pomArtifact.relativePath}`;

      return this.request(path);
    } catch (err) {
      if (err && err.code === 404) {
        this.log(`Failed to load POM info for build ${build}`);
        return;
      }

      return err;
    }
  }

  async fetchJarFilename(build, callback) {
    let path = `${build}/api/json`;

    this.log(`Fetching jar for build: ${build}`);

    try {
      const { artifacts } = await this.request(path);
    
      // check if artifact list is empty before filtering
      if (!artifacts || artifacts.length === 0) return;

      // filter out irrelevant artifacts
      artifacts = artifacts.filter(
        (artifact) => (artifact.fileName.match(this.artifactRegex))
      );

      // check if artifact list is empty after filtering
      if (!artifacts || artifacts.length === 0) return;

      let filename = artifacts[0].fileName;

      return filename;
    } catch (err) {
      return err;
    }
  }

  process(data) {
    const packages = [ ];

    for (const minecraftVersion in data) {
      const builds = data[minecraftVersion];
      if (!builds || builds.length === 0) {
        continue;
      }

      const idWithMcVersion = `${this.id}-${minecraftVersion}`;

      const pkg = {
        _id: idWithMcVersion,
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
        if (!info.jar) return;

        pkg.versions[info.id] = {
          id: info.id,
          version: info.name,
          minecraftVersion: info.minecraftVersion,
          origin: `${this.options.url}${info.id}/artifact/${info.jar}`,
          jar: info.jar
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
