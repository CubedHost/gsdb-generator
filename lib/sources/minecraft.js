import async from 'async';
import Source from './base';

class MinecraftSource extends Source {

  constructor(name, options) {
    super(name, options);
    this.ignoredPackages = options.ignore || [ ];
  }

  async fetchRemote() {
    try {
      const versions = await ::this.fetchManifest();
      return versions.forEach(async version => await ::this.fetchVersion(version));
    } catch (err) {
      return err;
    }
  }

  async fetchManifest() {
    try {
      const data = await ::this.request();
      return data ? data.versions : [];
    } catch (err) {
      return err;
    }
  }

  async fetchVersion(version) {
    const { id } = version;

    if (/^(a|b|c|rd-|inf)/.test(id)) {
      this.log(`Skipping manifest for version: ${id}`);
      return version;
    }

    this.log(`Fetching manifest for version: ${id}`);
    return await this.request(version.url);
  }

  async process(versions = []) {
    const { ignoredPackages } = this;
    const sourceId = this.id;
    const data = {};

    versions.forEach((version) => {
        const channel = version.type.replace(/old_/g, '');

        if (ignoredPackages.indexOf(channel) >= 0) return;

        const ignoredVersions = this.ignoredVersions[channel];
        if (ignoredVersions && ignoredVersions.indexOf(version.id) >= 0) {
          return;
        }

        let rawChannelName = channel.replace(/release/g, '');
        let channelName  = 'Minecraft ';
        channelName += rawChannelName.charAt(0).toUpperCase();
        channelName += rawChannelName.slice(1);
        channelName  = channelName.trim();

        let versionID = version.id
        if (channel === 'snapshot') {
          versionID = versionID
            .replace(/ Pre-Release /i, '-pre')
            .replace(/\s/g, '-');
          
          
        }

        if (!data[channel]) {
          data[channel] = {
            _id: 'minecraft-' + channel,
            name: channelName,
            visibility: 'public',
            source: sourceId,
            versions: [],
            version: versionID
          };
        }

        const versionObj = {
          id: versionID,
          version: versionID,
          minecraftVersion: version.id,
          published: version.releaseTime
        };

        if (version.downloads && version.downloads.server) {
          versionObj.origin = version.downloads.server.url;
        }

        data[channel].versions.push(versionObj);
    });

    let packages = [ ];
    Object.keys(data).forEach((channel) => {
      packages.push(data[channel]);
    });

    return {
      packages: packages,
      meta: {}
    };
  }

}

export default MinecraftSource;
