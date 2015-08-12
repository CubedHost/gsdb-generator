import BaseSource from '../lib/BaseSource';

const RELEASE_PATTERN = /minecraft(?:_server)?(?:\.([\d.]+))?\.jar/;
const SNAPSHOT_PATTERN = /minecraft(?:_(?:server|snapshot))?(?:\.([\w.]+))?\.jar/;

class MinecraftSource extends BaseSource {

  constructor(name, url, options) {
    super(name, url, options);
    this.ignoredPackages = options.ignore || [ ];
  }

  process(data) {
    let { ignoredPackages } = this;
    let sourceId = this.id;
    let versions = data.versions;

    data = { };

    versions.forEach((version) => {
        let channel = version.type;
        channel = channel.replace(/old_/g, '');

        if (ignoredPackages.indexOf(channel) >= 0) return;

        let rawChannelName = channel.replace(/release/g, '');
        let channelName  = 'Minecraft ';
        channelName += rawChannelName.charAt(0).toUpperCase();
        channelName += rawChannelName.slice(1);
        channelName  = channelName.trim();

        if (!data[channel]) {
          data[channel] = {
            _id: 'minecraft-' + channel,
            name: channelName,
            visibility: 'public',
            source: sourceId,
            versions: [],
            version: version.id
          };

          if (channel === 'release') {
            data[channel].pattern = RELEASE_PATTERN;
          } else if (channel === 'snapshot') {
            data[channel].pattern = SNAPSHOT_PATTERN;
          }
        }

        data[channel].versions.push({
          version: version.id,
          minecraftVersion: version.id,
          published: version.releaseTime
        });
    });

    let packages = [ ];
    Object.keys(data).forEach((channel) => {
      packages.push(data[channel]);
    });

    return packages;
  }

}

export default MinecraftSource;
