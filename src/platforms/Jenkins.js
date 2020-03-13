import Platform from './Platform';

export default class JenkinsPlatform extends Platform {
  builds = {};
  _packages = {};
  mainJars = [];
  tree = 'builds[actions[moduleRecords[mainArtifact[artifactId,canonicalName,fileName,version]]],number,result,url,artifacts[fileName,displayPath,relativePath],timestamp],firstBuild';

  async fetch() {
    return ::this.getBuildList();
  }

  async getBuildList() {
    this.log('Fetching build list from Jenkins');

    try {
      let builds = await ::this.fetchRecentBuildHistory();

      for (const build of builds) {
        this.builds[build.number] = {
          id: build.number,
          name: `#${build.number}`,
          ...build,
          created_at: new Date(build.timestamp)
        };
      }

      const buildCount = Object.keys(this.builds).length;
      this.log(`Found ${buildCount} builds`);

      return this.builds;
    } catch (err) {
      this.log(err);
      throw err;
    }
  }

  async fetchRecentBuildHistory() {
    let options = { format: 'json' };

    try {
      const projectInfo = await this.request(`${this.url}/api/json?tree=${this.tree}`, options);

      return ::this.iterateBuildHistory(projectInfo);
    } catch (err) {
      this.log(err);
      throw err;
    }
  }

  async iterateBuildHistory(projectInfo) {
    return projectInfo.builds
      .filter(b => b.result === 'SUCCESS');
  }

  async process(data) {
    const packages = [ ];

    for (const minecraftVersion in data) {
      const pkg = {
        id: `${data.id}`,
        name: `${this.name}`,
        source: this.id,
        versions: { },
        metadata: {
          mcversion: minecraftVersion
        }
      };

      // Select last build number as the latest version
      pkg.version = packages[builds.length - 1]['id'];

      for (const info of builds) {
        if (!info.jar) return;

        pkg.versions[info.id] = {
          version: info.number,
          origin: `${info.url}/artifact/${info.artifacts[0].relativePath}`
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
