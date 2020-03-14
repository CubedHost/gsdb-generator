import Platform from './Platform';

class ForgePlatform extends Platform {
  ignoredPackages = [ 'latest' ];

  async fetch() {
    try {
      return ::this.request('maven-metadata.json');;
    } catch (err) {
      throw err;
    }
  }

  async process(data) {
    const packages = { };

    for (const minecraftVersion in data) {
      const builds = data[minecraftVersion];

      let pattern = 'forge-';
      pattern += String(minecraftVersion).replace(/\./g, '\\.');
      pattern += '(?:[.-]((?:[\\d.]+)|latest|recommended))?';
      pattern += '(?:-universal)?\\.jar';
      pattern = new RegExp(pattern);

      const gameVersion = await ::this.findGameVersion(this, minecraftVersion);

      for (const version of builds) {
        const forgeVer = version.split('-', 2);

        if (forgeVer.length === 2) {
          if (typeof packages[gameVersion.version] === 'undefined') {
            packages[gameVersion.version] = {
              versions: [],
              name: `${this.name} for Minecraft ${gameVersion.version}`,
              slug: gameVersion.version,
              source_ref: gameVersion.version
            };
          }

          const pkg = {
            version: forgeVer[1],
            name: `${forgeVer[1]}`,
            game_version_id: gameVersion.id,
            package_id: this.id,
            origin: `${this.url}${gameVersion.version}-${forgeVer[1]}/forge-${minecraftVersion}-${forgeVer[1]}-installer.jar`
            // published: versionInfo.timestamp
          };

          const pkgEntry = this.packages.find(ep => ep.source_id === pkg.source_id && `${ep.version}` === `${pkg.version}`);
    
          if (typeof pkgEntry !== 'undefined') {
            if (pkgEntry.origin === pkg.origin) return;
            pkg.id = pkgEntry.id;
          }

          packages[gameVersion.version].versions.push(pkg);
        }
      }
    }

    return {
      packages,
      meta: {}
    };
  }

  async fetchPromotions() {
    this.log('Fetching promotions for Forge');

    try {
      const data = await this.request('promotions.json');
      const mcVersions = {};

      const promos = data.promos;
      for (const promoKey in promos) {
        const promo = promos[promoKey];

        const promoTypeMatch = promoKey.match(/-(latest|recommended)$/);
        if (!promoTypeMatch) continue;

        const [ , promoType ] = promoTypeMatch;
        const mcVersion = promo.mcversion;
        const { version } = promo;

        // Init if empty
        if (!mcVersions[mcVersion]) {
          mcVersions[mcVersion] = {};
        }

        mcVersions[mcVersion][promoType] = version;
      }

      return mcVersions;
    } catch (err) {
      throw err;
    }
  }

}

export default ForgePlatform;
