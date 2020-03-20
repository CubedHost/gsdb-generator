import Platform from './Platform';
import ATLauncher from 'atlauncher-api';

class ATLauncherPlatform extends Platform {
  includes = [];
  api = new ATLauncher({
    base_url: 'https://api.atlauncher.com/'
  });

  async fetch() {
    const data = await ::this.request(this.url);
    return data.data;
  }

  async getPackVersion(name, version, url) {
    const cache = await ::this.getFromCache(`pack_${name}_${version}`);
    if (cache) return cache;

    const res = await ::this.request(url);
    
    if (res.error) {
      return false;
    }

    await ::this.putCache(`pack_${name}_${version}`, res.data);
    return res.data;
  }

  async process(packs) {
    const packages = { };
    const { ignoredPackages = [ 'VanillaMinecraft' ] } = this;

    for (const originalPack of packs) {
      const { safeName } = originalPack;

      if (ignoredPackages.includes(safeName)) {
        this.log(`Skipping ignored pack: ${safeName}`);
        continue;
      } else if (!originalPack.versions.length) {
        this.log(`Skipping pack without versions: ${safeName}`);
        continue;
      } else if (originalPack.type !== 'public') {
        this.log(`Skipping non-public pack: ${safeName}`);
        continue;
      }

      for (const version of originalPack.versions) {
        const gameVer = await ::this.findGameVersion(this, version.minecraft);
        if (!gameVer) continue;

        if (typeof packages[safeName] === 'undefined') {
          packages[safeName] = {
            slug: originalPack.safeName,
            name: originalPack.name,
            versions: [],
            source_ref: originalPack.id
          };
        }

        const pack = await ::this.getPackVersion(originalPack.safeName, version.version, version.__LINK);
        if (!pack || !pack.serverZipURL) continue;

        const pkgEntry = this.packages.find(p => p.slug === safeName).versions.find(ep => `${ep.version}` === `${version.id}`);
        if (pkgEntry && pkgEntry.origin) continue;

        packages[safeName].versions.push({
          package_id: this.id,
          game_version_id: gameVer.id,

          name: version.version,
          version: version.version,

          origin: pack.serverZipURL
        });
      }
    }

    const finalPkgs = Object.keys(packages)
      .filter(p => packages[p].versions.length > 0)
      .map(p => packages[p]);

    const diff = Object.keys(packages).length - Object.keys(finalPkgs).length;

    if (diff > 0) {
      this.log(`${diff} package(s) skipped due to lack of buildable versions.`);
    }

    for (const pkgId in packages) {
      if (finalPkgs.includes(pkgId)) continue;
      delete packages[pkgId];
    }

    return {
      packages,
      meta: {}
    };
  }
}

export default ATLauncherPlatform;