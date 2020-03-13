import url from 'url';
import Platform from './Platform';

const SERVER_MAPPINGS = {
  'attack-of-the-bteam': 'servers/bteam/BTeam_Server_v',
  'tekkitmain': 'servers/tekkitmain/Tekkit_Server_v',
  'tekkit': 'servers/tekkit/Tekkit_Server_',
  'bigdig': 'servers/bigdig/BigDigServer-v',
  'hexxit': 'servers/hexxit/Hexxit_Server_v',
  'voltz': 'servers/voltz/Voltz_Server_v',
  'tekkitlite': 'servers/tekkitlite/Tekkit_Lite_Server_',
  'blightfall': 'servers/blightfall/Blightfall_Server_v',
  'tppi': 'servers/tppi/TPPIServer-v',
  'tekkit-legends': 'servers/tekkit-legends/Tekkit_Legends_Server_v'
};

class TechnicPlatform extends Platform {
  async fetch() {
    try {
      const data = await ::this.request();
      this.mirror_url = data.mirror_url;

      if (typeof data.modpacks === 'undefined') {
        return new Error('Received no modpack data');
      }

      let modpacks = [];

      for (const key of Object.keys(data.modpacks)) {
        try {
          modpacks.push(await ::this.request(key));
        } catch (err) {
          this.log(err);
        }
      }

      return modpacks;
    } catch (err) {
      throw err;
    }
  }

  async getModpackVersion(modpack, version) {
    let cached = await ::this.getFromCache(`modpack_version_${version}`);
    if (cached) {
      return cached;
    }

    const versionData = await ::this.request(`${modpack}/${version}`);
    await this.putCache(`modpack_version_${version}`, versionData);
    return versionData;
  }

  async process(data) {
    const { ignoredPackages = [ 'vanilla' ] } = this;
console.log(data);
    let packages = { };

    if (!data) return {
      packages,
      meta: {}
    };
console.log('here');
    for (const originalPack of data) {
      console.log(originalPack);

      if (ignoredPackages.includes(originalPack.name)) {
        this.log('Skipping ignored package: %s', originalPack.name);
        continue;
      }

      let id = originalPack.name
        .toLowerCase()
        .replace(/tekkitmain$/, 'tekkit');

      let pattern = `^${this.id}-${id}(?:[.-]([\\d.]+))?\\.jar$`;
      pattern = new RegExp(pattern);

      let origin = `${this.url}/${originalPack.name}`;

      if (typeof packages[originalPack.name] === 'undefined') {
        packages[originalPack.name] = {
          name: originalPack.display_name,
          origin,
          source_ref: originalPack.name,
          slug: originalPack.name,
          versions: []
        };
      }
      for (const version of originalPack.builds) {
        const versionData = await ::this.getModpackVersion(originalPack.name, version);
        if (!versionData) continue;

        const gameVer = await ::this.findGameVersion(this, versionData.minecraft);
        if (!gameVer) continue;

        packages[originalPack.name].versions.push({
          package_id: this.id,
          game_version_id: gameVer.id,
          name: `${originalPack.display_name} ${version}`,
          version,
          origin: `${origin}/${version}.zip`
        });
      }
    }

    return {
      packages,
      meta: {}
    };
  }

}

export default TechnicPlatform;
