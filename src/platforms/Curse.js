import path from 'path';
import Platform from './Platform';

const CONCURRENCY = 5;
const SLUG_REGEX = /minecraft\/modpacks\/(?:[0-9]+-)?(.*)/;
const VERSION_REGEX = /\(?-?v?((?:(?:[Aa]lpha|[Bb]eta)\s*)?\d+(?:\.[\da-zA-Z.-]+)?)\)?$/;
const CURSEFORGE_URL = 'https://addons-ecs.forgesvc.net/api/v2';
const FileSizes = {
  'KB': 1,
  'MB': 1000,
  'GB': 1000000
};

class CursePlatform extends Platform {
  broken = {};

  formatVersion(version) {
    let filename = version.fileName;

    if (/\.(jar|zip)$/.test(filename)) {
      const ext = path.extname(filename);
      filename = path.basename(version.fileName, ext);
    }

    let versionText = filename.match(VERSION_REGEX);
    versionText = versionText ? versionText[1].trim() : version.id;

    return versionText;
  }

  get curseRequestOpts() {
    return {
    };
  }

  async fetch() {
    const packs = await ::this.fetchModpacks();
    return packs;
  }

  async fetchModpacks() {
    this.log(`Looking up addon IDs ${Object.values(this.includes).join(', ')} in CurseForge API`);

    let packs = await this.request(`addon`, {
      method: 'POST',
      body: JSON.stringify(this.includes),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.log(`Fetching files for all listed addon IDs`);

    let res = [];

    for (let pack of packs) {
      res.push(await ::this._modpackProcess(pack));
    }

    return res.filter(Boolean);
  }

  async _modpackProcess(pack) {
    try {
      if (pack.categorySection.name !== 'Modpacks') {
        this.log(`${pack.name} (${pack.id}) is not a modpack; skipping.`);
        return false;
      }
      pack.files = await ::this.fetchModpackFiles(pack);
    } catch (err) {
      this.broken[pack.id] = true;
      this.log(`Error while processing ${pack.id}: ${err}`);
      return false;
    }

    return pack;
  }

  async fetchModpackFiles(pack) {
    try {
      const files = await this.request(`addon/${pack.id}/files`, this.curseRequestOpts);

      return files
        .filter(f => f.isAvailable && f.serverPackFileId)
        .map(file => {
          file.name = this.formatVersion(file);
          file.serverDownload = async () => this.request(`${CURSEFORGE_URL}/addon/${pack.id}/file/${file.serverPackFileId}/download-url`);
          file.created_at = new Date(file.fileDate);

          return file;
        })
        .filter(Boolean)
        .filter(f => typeof f.serverDownload !== 'undefined');
    } catch (err) {
      this.log(`Failed to fetch addon files for ${pack.id}: ${err}`);
      this.broken[pack.id] = true;
    }
  }

  async process(addons) {
    // Keep track of IDs to avoid duplicates
    const idMap = {};

    this.log(`Processing ${addons.length} addons`);

    const packages = {};

    for (const originalPack of addons) {
      if (!originalPack) {
        this.log(`Original pack was: ${typeof originalPack}`);
        continue;
      }

      const {
        files
      } = originalPack;

      if (!files || files.length === 0) {
        this.log(`Skipping ${originalPack.id} for zero length files`);
        continue;
      }

      if (typeof packages[originalPack.slug] === 'undefined') {
        packages[originalPack.slug] = {
          versions: [],
          name: originalPack.name,
          slug: originalPack.slug,
          source_ref: originalPack.id
        };
      }

      for (const file of files) {
        if (!file.serverDownload) {
          this.log(`Skipping version ${file.id} with modpack ${originalPack.id} with no server pack`);
          continue;
        }

        const minecraftVersion = (file.gameVersion || []).sort().pop();
        const gameVer = await ::this.findGameVersion(this, minecraftVersion);
        if (!gameVer) continue;

        const pkg = {
          package_id: this.id,
          game_version_id: gameVer.id,
  
          name: `${file.name}`,
          version: `${file.id}`,
  
          origin: file.serverDownload,
          created_at: file.created_at
        };
        
        try {
          const pkgEntry = this.packages[originalPack.slug].versions.find(ep => `${ep.version}` === `${version.id}`);
          if (pkgEntry && pkgEntry.origin) continue;
        } catch (err) {
          // Do nothing. 
        }

        packages[originalPack.slug].versions.push(pkg);
      }
    }

    return { packages, meta: {} };
  }
}

export default CursePlatform;