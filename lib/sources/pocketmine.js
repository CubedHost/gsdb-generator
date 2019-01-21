import GitHubSource from './github';

const MINECRAFT_VERSION_REGEX = /^\*\*For ([\w: ]+) ((?:(?:[\d\.]+)(?:[\w ]+)?(?:, )?)+)\*\*$/g;
const POCKETMINE_VERSION_REGEX = /^PocketMine(?:-MP)? ([\w\d\.-]+)(?: "[\w ]+")?(?: with API (.+))?$/g;

export default class PocketMineSource extends GitHubSource {

  constructor(...params) {
    super(...params);

    this.packages = {};
  }

  process(result) {
    let { github, poggit } = result;
    const sourceId = this.id;
    const data = {};

    github.forEach((release) => {
      // Get the Minecraft version for this PocketMine version
      let versionLine = release.body.split('\n')[0].trim();
      let match = new RegExp(MINECRAFT_VERSION_REGEX).exec(versionLine);
      let editionName = match[1];
      let editionVersionString = match[2];

      let pmVersion = new RegExp(POCKETMINE_VERSION_REGEX).exec(release.name);
      let pmApiVersion = pmVersion[2] ? pmVersion[2] : pmVersion[1];
      pmVersion = pmVersion[1];

      if (!poggit[pmApiVersion]) {
        this.log(`Skipping PocketMine ${pmVersion} (API ${pmApiVersion}): no Poggit entry`);
        return;
      }

      const gsdbRelease = {
        version: pmVersion,
        origin: release.assets && release.assets.length > 0
          ? release.assets[0].browser_download_url : undefined,
        php: poggit[pmApiVersion].php[0]
      };

      // Handle PocketMine versions that display support for multiple
      // Minecraft versions by adding the release info to all of the
      // supported Minecraft versions
      let editionVersions = editionVersionString.split(', ');
      editionVersions.forEach((version) => {
        let slugVersion = version.replace(' ', '-');

        if (!data[slugVersion]) {
          data[slugVersion] = {
            _id: 'pocketmine-minecraft-' + slugVersion,
            name: editionName + ' ' + version,
            visibility: 'public',
            source: sourceId,
            versions: [],
            // TODO: We're assuming that the latest release will always come
            //  first; better to check the publish date
            version: gsdbRelease.version
          };
        }

        data[slugVersion].versions.push(gsdbRelease);
      });
    });

    return data;
  }

  async scrape(callback) {
    const github = await this.scrapeGH();
    if (github.err) {
      return callback(github.err);
    }

    this.request('https://poggit.pmmp.io/pmapis', {format: 'json'}, (err, data) => {
      if (err) {
        return callback(err);
      }

      try {
        return callback(null, this.process({github: github.result, poggit: data}));
      } catch (err) {
        console.log('Error while processing');
        return callback(err);
      }
    });
  }
}
