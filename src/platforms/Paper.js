import MinecraftJava from './MinecraftJava';

const PAPER_JAR_REGEX = /paper\-(?<version>[0-9\.+]+)\.jar/i;

class PaperPlatform extends MinecraftJava {

  async fetch() {
    const res = [];

    for (const verGroup of (await this.request()).version_groups) {
      const vgBuilds = await this.request(`${this.url}/version_group/${verGroup}/builds`);

      for (const build of vgBuilds.builds) {
        try {

          const gameVer = await ::this.findGameVersion(this, build.version);
          if (!gameVer) continue;
  
          res.push({
            id: build.build,
            name: `#${build.build}`,
            version: build.build,
            gameVersion: gameVer,
            verGroup,
            origin: `${this.url}/versions/${build.version}/builds/${build.build}/downloads/${build.downloads.application.name}`,
            created_at: build.time
          });
        } catch (err) {
          this.log(`Failed to prepare ${build.version} #${build.build}: ${err}`);
        }
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
        if (typeof packages[gameVer.id] === 'undefined') {
          packages[gameVer.id] = {
            versions: [],
            name: `${this.name} ${gameVer.version}`,
            slug: gameVer.version,
            source_ref: `Paper-${version.verGroup}`
          };
        }

        try {
          const pkgEntry = this.packages.find(pkg => pkg.slug === gameVer.version).versions.find(ep => `${ep.version}` === `${version.id}`);
          if (pkgEntry && pkgEntry.origin) continue;

          packages[gameVer.id].versions.push({
            package_id: this.id,
            game_version_id: gameVer.id,
  
            name: `${gameVer.version} #${version.id}`,
            version: version.id,
  
            origin: version.origin,
            created_at: version.created_at,
            updated_at: version.updated_at
          });
        } catch (err) {
          console.log(gameVer, err);
          // Do nothing.
        }
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