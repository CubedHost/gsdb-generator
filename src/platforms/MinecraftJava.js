import Platform from './Platform';

class MinecraftJava extends Platform {
  async fetch() {
    try {
      return ::this.fetchManifest();
    } catch (err) {
      throw err;
    }
  }

  async fetchManifest() {
    try {
      const data = await ::this.request();
      return data ? data.versions : [];
    } catch (err) {
      throw err;
    }
  }

  async fetchVersion(version) {
    const { id } = version;

    if (/^(a|b|c|rd-|inf)/.test(id)) {
      this.log(`Skipping manifest for version: ${id}`);
      return version;
    }

    const cache = await this.getFromCache(`manifest_${id}`);
    if (cache) return cache;

    this.log(`Fetching manifest for version: ${id}`, version.url);
    const manifest = await ::this.request(version.url);
    await ::this.putCache(`manifest_${id}`, manifest);
    return manifest;
  }


  fixVersion(versionString) {
    return versionString
      .replace(/ Pre-Release /i, '-pre')
      .replace(/\s/g, '-');
  }

  async process(versions = []) {
    const { ignoredPackages = [], ignoredVersions = [] } = this;
    const packages = { };

    for (const version of versions) {
      const channel = version.type;

      if (channel === 'snapshot') {
        version.id = this.fixVersion(version.id);
      }

      if (ignoredPackages.includes(channel)) continue;
      if (ignoredVersions[channel] && ignoredVersions[channel].includes(version.id)) continue;

      if (typeof packages[channel] === 'undefined') {
        let rawChannelName = channel.replace(/release/g, '');
        let channelName = 'Minecraft ';
        channelName += rawChannelName.charAt(0).toUpperCase();
        channelName += rawChannelName.slice(1);
        channelName = channelName.trim();

        packages[channel] = {
          versions: [],
          source_ref: channel,
          slug: channel,
          name: channelName
        };
      }

      try {
        const pkgEntry = this.packages[channel].versions.find(ep => `${ep.version}` === `${version.id}`);
        if (pkgEntry && pkgEntry.origin) continue;
      } catch (err) {
        // Do nothing. 
      }

      const versionData = await ::this.fetchVersion(version);
      const gameVersion = await ::this.findGameVersion(this, version.id);

      const versionObj = {
        version: version.id,
        name: version.id,
        package_id: this.id,
        game_version_id: gameVersion.id,
        origin: versionData.url,
        created_at: new Date(version.releaseTime),
        updated_at: new Date(),
      };

      if (versionData.downloads && versionData.downloads.server) {
        versionObj.origin = versionData.downloads.server.url;
        versionObj.active = true;
      } else {
        versionObj.active = false;
      }

      packages[channel].versions.push(versionObj);
    }

    return {
      packages,
      meta: {}
    };
  }

}

export default MinecraftJava;