import Platform from './Platform';

class SpongePlatform extends Platform {
  async fetch() {
    try {
      const data = await ::this.request();
      const mcVersions = data.dependencies.minecraft;

      let res = [];
      for (const ver of mcVersions) {
        const verData = await ::this.request(`${this.url}/downloads?minecraft=${ver}&limit=100`);
        res = res.concat(verData);
      }

      return res;
    } catch (err) {
      throw err;
    }
  }

  async process(data) {
    const packages = { };

    for (const version of data) {
      const { groups } = version.version.match(new RegExp(this.versionRegex));

      const gameVer = await ::this.findGameVersion(this, groups.mcVer);
      if (!gameVer) continue;

      if (typeof packages[groups.mcVer] === 'undefined') {
        packages[groups.mcVer] = {
          versions: [],
          name: `${this.name} for ${groups.mcVer}`,
          slug: groups.mcVer,
          source_ref: groups.mcVer
        }
      }

      packages[groups.mcVer].versions.push({
        package_id: this.id,
        game_version_id: gameVer.id,

        name: groups.spongeVer,
        version: groups.spongeVer,

        origin: version.artifacts[''].url
      });
    }

    return { packages, meta: {} };
  }

}

export default SpongePlatform;