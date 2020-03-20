import JenkinsPlatform from './Jenkins';

export default class PocketMinePlatform extends JenkinsPlatform {
  pharRegex = /PocketMine-MP[.*]+\.phar/i;

  async fetchBuildInfo(build) {
    const cached = await ::this.getFromCache(`build_${build.id}`);
    if (cached) {
      return cached;
    }

    const buildInfo = await this.request(`${build.url}artifact/build_info.json`);
    await ::this.putCache(`build_${build.id}`, buildInfo);
    return buildInfo;
  }

  async process(builds) {
    const packages = {};

    for (const buildId in builds) {
      const build = builds[buildId];

      build.info = await ::this.fetchBuildInfo(build);
      let pharName = build.info.phar_name || 'PocketMine-MP.phar';
      const gameVersion = await ::this.findGameVersion(this, build.info.mcpe_version);
      if (!gameVersion) continue;

      if (!packages[gameVersion.version]) {
        packages[gameVersion.version] = {
          versions: [],
          name: `${this.name} for Bedrock ${gameVersion.version}`,
          slug: gameVersion.version,
          source_ref: gameVersion.version
        };
      }

      try {
        const pkgEntry = this.packages.find(p => `${p.slug}` === `${gameVersion.version}`).versions.find(ep => `${ep.version}` === `${build.number}`);
        if (pkgEntry && pkgEntry.origin) continue;
      } catch (err) {
        // Do nothing. 
      }

      packages[gameVersion.version].versions.push({
        package_id: this.id,
        game_version_id: gameVersion.id,

        name: `${this.name} ${build.info.pm_version || build.info.base_version} #${build.number}`,
        version: build.number,

        origin: `${build.url}artifact/${pharName}`,
        created_at: build.created_at
      });
    }

    return {
      packages: packages,
      meta: {}
    };
  }
}