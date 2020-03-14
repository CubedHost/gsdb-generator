import Jenkins from './Jenkins';
import { sortVersions } from '../util';
import { Builder } from 'xml2js';

export default class JenkinsPomPlatform extends Jenkins {
  builds = {};
  _packages = {};
  mainJars = [];
  tree = 'builds[actions[moduleRecords[mainArtifact[artifactId,canonicalName,fileName,version]]],number,result,url,timestamp,artifacts[fileName,displayPath,relativePath],mavenArtifacts[moduleRecords[mainArtifact[fileName,version]]]],firstBuild';

  async fetch() {
    await ::this.getBuildList();
    await ::this.mapJarFilenames();
    return this.builds;
  }

  getMinecraftVersionFromPom(parentPom) {
    return parentPom.version.replace(/-SNAPSHOT.*/, '');
  }

  async mapJarFilenames() {
    this.log('Mapping origin jar filenames from Jenkins artifacts');

    for (const number in this.builds) {
      let build = this.builds[number];

      try {
        const moduleRecords = build.actions.find(a => typeof a.moduleRecords !== 'undefined').moduleRecords;
        const mainArtifact = moduleRecords.find(a => a.mainArtifact.artifactId === this.artifactId).mainArtifact;
        if (!mainArtifact) continue;
  
        this.builds[build.id].mainArtifact = mainArtifact;

        // check if artifact list is empty before filtering
        if (!mainArtifact || mainArtifact.length === 0) {
          delete this.builds[number];
          continue;
        }

        if (build.artifacts) {
          this.builds[build.number].jar = build.artifacts[0].relativePath;
        } else if (mainArtifact.fileName) {
          this.builds[build.number].jar = mainArtifact.fileName;
        }
      } catch (err) {
        this.log(err);
      }
    }
  }

  async process(builds) {
    const packages = { };

    for (const buildId in builds) {
      const build = builds[buildId];

      const artifactVer = build.mainArtifact.version.match(/^(?<version>[0-9\.]+)\-SNAPSHOT/i);
      if (!artifactVer || !artifactVer.groups) continue;

      const gameVer = await ::this.findGameVersion(this, artifactVer.groups.version);
      if (!gameVer) return;

      if (typeof packages[gameVer.id] === 'undefined') {
        packages[gameVer.id] = {
          versions: [],
          name: `${this.name} ${gameVer.version}`,
          source_ref: gameVer.version,
          slug: gameVer.version
        };
      }

      try {
        const pkgEntry = this.packages[gameVer.id].versions.find(ep => `${ep.version}` === `${version.id}`);
        if (pkgEntry && pkgEntry.origin) continue;
      } catch (err) {
        // Do nothing. 
      }

      packages[gameVer.id].versions.push({
        package_id: this.id,
        game_version_id: gameVer.id,

        name: `${gameVer.version} #${build.number}`,
        version: build.number,

        origin: `${this.url}/${build.id}/artifact/${build.jar}`,
        created_at: new Date(build.timestamp)
      });
    }

    return {
      packages,
      meta: {}
    };
  }
}
