import Platform from './Platform';

// See: https://github.com/FTBTeam/FTB-App
// API Base URL: https://api.modpacks.ch
// /public/modpack/:packID/:versionID?
// /public/modpack/popular/installs/:limit
// /public/modpack/:packID/:versionID
// /public/modpack/:packID/:versionID/server/linux downloads a binary for CreeperHost's download tool. Do not mistake this as a potential useful route.

class FeedTheBeastPlatform extends Platform {

  async fetch() {
    const data = await ::this.request('all', {});
    return data;
  }

  async process(data) {
    console.log(data);
    this.log(`Processing ${data?.packs?.length} packs`);

    const packages = {};

    for (const packId of data?.packs) {
      const pack = await ::this.request(`${packId}`);

      var id = pack.name
        .replace(/(FTB Presents|FTB|ftb_)/ig, '')
        .replace(/([a-z])_([A-Z])/g, '$1-$2')
        .replace(/_(\d+)_(\d+)_(\d+)$/g, '-$1.$2.$3')
        .replace(/_(\d+)_(\d+)$/g, '-$1.$2')
        .replace(/_(\d)(\d)$/g, '-$1.$2')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/([a-z])_(\d+)/g, '$1$2')
        .replace(/['"]/g, '')
        .replace(/[ ]+/g, '-')
        .replace(/[-]{2,}/g, '-')
        .toLowerCase();

      if (typeof packages[pack.id] === 'undefined') {
        packages[pack.id] = {
          versions: [],
          name: pack.name,
          slug: id,
          source_ref: pack.id
        };
      }

      for (const packVersion of pack?.versions) {
        const version = pack.tags.find(o => o.name.match(/(1\.)([0-9]{1,2}\.)([0-9]+)?/))?.name;
        const gameVer = await ::this.findGameVersion(this, version ?? '1.7.10');
        if (!gameVer) continue;

        const pkg = {
          package_id: this.id,
          game_version_id: gameVer.id,
  
          name: `${packVersion.name}`,
          version: `${packVersion.id}`,
  
          origin: '',
          created_at: new Date(packVersion.updated * 1000)
        };
  
        try {
          const pkgEntry = this.packages[pack.id].versions.find(ep => `${ep.version}` === `${packVersion.name}`);
          if (pkgEntry?.origin) continue;
        } catch (err) {
          // Do nothing. 
        }

        packages[pack.id].versions.push(pkg);
      }
    }

    return { packages, meta: {} };
  }
}

export default FeedTheBeastPlatform;

/**
 * Provides a version descriptor object for individual versions of FTB modpacks
 *
 * @param {Object} pack    Original modpack descriptor object
 * @param {String} version Version number
 * @returns {Object} Version descriptor
 */
function generateVersion(pack, version) {
  return {
    id: version,
    'version': version,
    'minecraftVersion': pack.mcVersion
  };
}
