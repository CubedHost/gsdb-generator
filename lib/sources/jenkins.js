import async from 'async';
import Source from './base';
import { matchAll, sortVersions } from '../util';

const BUILD_NUMBER_REGEX = /#[0-9]+/g;
const OLDEST_ENTRY_REGEX = /page-entry-oldest="(-?[0-9]+)"/g;

export default class JenkinsSource extends Source {
  builds = {};
  packages = {};
  mainJars = [];

  async fetch() {
    await ::this.getBuildList();
    await ::this.mapJarFilenames();
    await ::this.mapMinecraftVersions();
    return await sortVersions(this.packages);
  }

  async getBuildList() {
    this.log('Fetching build list from Jenkins');

    try {
      let builds = await ::this.fetchRecentBuildHistory();

      for (const build of builds) {
        this.builds[build.number] = {
          id: build.number,
          name: `#${build.number}`,
          ...build
        };
      }

      const buildCount = Object.keys(this.builds).length;
      this.log(`Found ${buildCount} builds`);
    } catch (err) {
      this.log(err);
      return err;
    }
  }

  getMinecraftVersionFromPom(parentPom) {
    return parentPom.version.replace(/-SNAPSHOT.*/, '');
  }

  async mapMinecraftVersions() {
    this.log('Fetching Minecraft versions via pom');

    for (const number in this.builds) {
      await ::this.mapMinecraftVersion(this.builds[number]);
    }
  }

  async mapMinecraftVersion(build) {
    try {
      const { mainArtifact } = build;
      if (!this.mainJars.includes(mainArtifact.fileName)) this.mainJars.push(mainArtifact.fileName);

      let minecraftVersion = ::this.getMinecraftVersionFromPom(mainArtifact);
      if (!minecraftVersion) return;

      build.minecraftVersion = minecraftVersion;

      if (!this.packages[minecraftVersion]) {
        this.packages[minecraftVersion] = [];
      }

      this.packages[minecraftVersion].push(build);
    } catch (err) {
      this.log(err);
    }
  }

  async mapJarFilenames() {
    this.log('Mapping origin jar filenames from Jenkins artifacts');

    for (const number in this.builds) {
      let build = this.builds[number];

      try {
        const moduleRecords = build.actions.find(a => typeof a.moduleRecords !== 'undefined').moduleRecords;
        const mainArtifact = moduleRecords.find(a => a.mainArtifact.artifactId === this.artifactId).mainArtifact;
        if (!mainArtifact) return;
  
        this.builds[build.id].mainArtifact = mainArtifact;

        // check if artifact list is empty before filtering
        if (!mainArtifact || mainArtifact.length === 0) {
          delete this.builds[number];
          continue;
        }

        if (mainArtifact.fileName) {
          this.builds[build.number].jar = mainArtifact.fileName;
        }
      } catch (err) {
        this.log(err);
      }
    }
  }

  async fetchRecentBuildHistory() {
    let options = { format: 'json' };

    try {
      const projectInfo = await this.request(`${this.url}/api/json?tree=builds[actions[moduleRecords[mainArtifact[artifactId,canonicalName,fileName,version]]],number,result,url,artifacts[fileName,displayPath,relativePath]],firstBuild`, options);

      if (!projectInfo.firstBuild) {
        return [];
      }

      return projectInfo.builds
        .filter(b => b.result === 'SUCCESS');
    } catch (err) {
      this.log(err);
      return err;
    }
  }

  async process(data) {
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

      for (const info of builds) {
        if (!info.jar) return;

        pkg.versions[info.id] = {
          id: info.number,
          version: info.name,
          minecraftVersion: info.minecraftVersion,
          origin: `${this.options.url}/${info.id}/artifact/${info.jar}`,
          jar: info.jar
        };
      }

      packages.push(pkg);
    }

    return {
      packages: packages,
      meta: {}
    };
  }
}
