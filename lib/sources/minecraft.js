import Source from './base';

const RELEASE_PATTERN = /minecraft(?:_server)?(?:\.([\d.]+))?\.jar/;
const SNAPSHOT_PATTERN = /minecraft_(?:server(?:\.([0-9]+w[0-9]+\w))|snapshot(?:\.([0-9]+w[0-9]+\w))?)\.jar/;

class MinecraftSource extends Source {

  constructor(name, url, options) {
    super(name, url, options);
    this.ignoredPackages = options.ignore || [ ];
  }

  fetchRemote(callback) {
    super.fetchRemote((err, data) => {
      return callback(err, !err && data ? data.versions : []);
    });
  }

  process(versions) {
    let { ignoredPackages } = this;
    let sourceId = this.id;
    let data = {};

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
