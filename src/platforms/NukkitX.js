import JenkinsPlatform from './Jenkins';
const NUKKIT_JAR_REGEX = /(nukkit\-([0-9\.]+)\-SNAPSHOT\.jar|Nukkit\.jar)/i;
class NukkitXPlatform extends JenkinsPlatform {
  jobs = {
    'master': '1.0',
    '2.0': '2.0'
  };
  tree = 'jobs[name,url,builds[number,result,url,artifacts[fileName,displayPath,relativePath]]]';

  async iterateBuildHistory(projectInfo) {
    const jobs = projectInfo.jobs.filter(j => typeof this.jobs[j.name] !== 'undefined');
    const res = [];

    for (const job of jobs) {
      const validBuilds = (job.builds || [])
        .filter(o => o.result === 'SUCCESS')
        .filter(o => o.artifacts.filter(a => NUKKIT_JAR_REGEX.test(a.fileName)))
        .filt
        .map(o => { return { artifact: o.artifacts[0], ...o }; })
        .filter(o => typeof o.artifact.fileName === 'undefined');
      if (validBuilds.length === 0) {
        this.log(`Unable to find any valid version for ${job.name}, skipping.`);
        this.log(build.artifacts);
        continue;
      }
      for (const build of validBuilds) {
        const verMatch = build.artifact.fileName.match(NUKKIT_JAR_REGEX);
        console.log(build);
        if (!verMatch || !verMatch.groups) continue;

        const gameVer = await ::this.findGameVersion(this, verMatch.groups.version);
        if (!gameVer) continue;

        res.push({
          id: build.number,
          name: `#${build.number}`,
          gameVersion: gameVer,
          ...build,
          job,
          origin: `${build.url}/artifact/${build.artifact.fileName}`
        });
      }
    }

    return res;
  }

  async process(data) {
    let packages = { };

    console.log(data);

    for (const versionIdx in data) {
      const version = data[versionIdx];

      try {
        const gameVer = version.gameVersion;
        if (typeof packages[gameVer.version] === 'undefined') {
          packages[gameVer.version] = {
            versions: [],
            name: gameVer.version,
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

          origin: version.url
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

export default NukkitXPlatform;