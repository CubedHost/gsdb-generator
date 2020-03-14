import JenkinsPlatform from './Jenkins';

const PAPER_JAR_REGEX = /paper\-(?<version>[0-9\.+]+)\.jar/i;

class PaperPlatform extends JenkinsPlatform {
  jobs = [];
  tree = 'jobs[name,url,builds[timestamp,actions[moduleRecords[mainArtifact[artifactId,canonicalName,fileName,version]]],number,result,url,artifacts[fileName,displayPath,relativePath],mavenArtifacts[moduleRecords[mainArtifact[fileName,version]]]],firstBuild]';

  get module() {
    if (this.build < 444) return 'org.github.paperspigot$paperspigot';
    return 'com.destroystokyo.paper$paper';
  }

  get artifactId() {
    return 'paper';
  }

  async iterateBuildHistory(projectInfo) {
    const jobs = projectInfo.jobs.filter(j => /^Paper(\-[0-9\.]+)?$/.test(j.name));
    const res = [];

    for (const job of jobs) {
      for (const build of job.builds) {
        let paperArtifact = (build.mavenArtifacts || { moduleRecords: [] })
          .moduleRecords
          .filter(o => o.result !== 'SUCCESS')
          .filter(o => PAPER_JAR_REGEX.test(o.mainArtifact.fileName))
          .map(o => o.mainArtifact);

        if (paperArtifact.length === 0 || build.artifacts.length === 0) {
          this.log(`Unable to find version for ${job.name} build #${build.number}, skipping.`);
          continue;
        }

        const verMatch = paperArtifact[0].fileName.match(PAPER_JAR_REGEX);
        const gameVer = await ::this.findGameVersion(this, verMatch.groups.version);
        if (!gameVer) continue;

        res.push({
          id: build.number,
          name: `#${build.number}`,
          gameVersion: gameVer,
          ...build,
          job,
          origin: `${build.url}artifact/${build.artifacts[0].fileName}`,
          created_at: build.created_at
        });
      }
    }

    return res;
  }

  async process(data) {
    let packages = { };

    for (const versionIdx in data) {
      const version = data[versionIdx];

      try {
        const gameVer = version.gameVersion;
        if (typeof packages[gameVer.version] === 'undefined') {
          packages[gameVer.version] = {
            versions: [],
            name: `${this.name} ${gameVer.version}`,
            slug: gameVer.version,
            source_ref: version.job.name
          };
        }

        try {
          const pkgEntry = this.packages[gameVer.version].versions.find(ep => `${ep.version}` === `${version.id}`);
          if (pkgEntry && pkgEntry.origin) continue;
        } catch (err) {
          // Do nothing. 
        }
        
        packages[gameVer.version].versions.push({
          package_id: this.id,
          game_version_id: gameVer.id,

          name: `${gameVer.version} #${version.number}`,
          version: version.number,

          origin: version.origin,
          created_at: version.created_at,
          updated_at: version.updated_at
        });
      } catch (err) {
        this.log(err.message, this.options, version.minecraftVersion);
        throw err;
        // Do nothing.
      }
    }

    return {
      packages,
      meta: {}
    };
  }
}

export default PaperPlatform;