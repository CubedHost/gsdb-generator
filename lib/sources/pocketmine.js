import GitHubSource from './github';

const MINECRAFT_VERSION_REGEX = /^\*\*For ([\w: ]+) ((?:(?:[\d\.]+)(?:[\w ]+)?(?:, )?)+)\*\*$/g;
const POCKETMINE_VERSION_REGEX = /^PocketMine(?:-MP)? ([\w\d\.-]+)(?: "[\w ]+")?(?: with API (.+))?$/g;
const DEFAULT_PM_PHP_VERSIONS = [
  { pm: /^[01]\.(.*)$/g, php: '5.6' },
  { pm: /^[23]\.(.*)$/g, php: '7.2' },
];
const FALLBACK_PHP_VERSION = '7.2';

export default class PocketMineSource extends GitHubSource {

  constructor(...params) {
    super(...params);

    this.packages = {};
  }

  process(result) {
    let { github, poggit } = result;
    const sourceId = this.id;
    const data = {};

    // [{pmVersion, minecraftVersions: []}]
    const noPhpVersions = [];

    // mcVersion (x.y.z) => gsdbRelease struct
    const latest = {};

    github.forEach((release) => {
      // Get the Minecraft version for this PocketMine version
      let versionLine = release.body.split('\n')[0].trim();
      let match = new RegExp(MINECRAFT_VERSION_REGEX).exec(versionLine);
      let editionName = match[1];
      let editionVersionString = match[2];

      let pmVersion = new RegExp(POCKETMINE_VERSION_REGEX).exec(release.name);
      let pmApiVersion = pmVersion[2] ? pmVersion[2] : pmVersion[1];
      pmVersion = pmVersion[1];

      // Handle PocketMine versions that display support for multiple
      // Minecraft versions by adding the release info to all of the
      // supported Minecraft versions
      let minecraftVersions = editionVersionString.split(', ')
        .map((v) => v.replace(' ', '-'));

      let phpVersion = undefined;
      if (poggit[pmApiVersion]) {
        phpVersion = poggit[pmApiVersion].php[0];
      } else {
        // Mark the PM version as having no PHP version, and attempt to find
        // one after we finish compiling the rest of the data
        noPhpVersions.push({ pmVersion, minecraftVersions });
      }

      const gsdbRelease = {
        version: pmVersion,
        origin: release.assets && release.assets.length > 0
          ? release.assets[0].browser_download_url : undefined,
        php: phpVersion,
        published: release.published_at,
        minecraftVersions: minecraftVersions
      };

      gsdbRelease.minecraftVersions.forEach((version) => {
        if (!data[version]) {
          data[version] = {
            _id: 'pocketmine-minecraft-' + version,
            name: editionName + ' ' + version,
            visibility: 'public',
            source: sourceId,
            versions: [],
            version: gsdbRelease.version
          };

          // Automatically assume this release is latest until we find a
          // newer one
          latest[version] = gsdbRelease;
        } else {
          // Compare to see if this release is newer; if so, update the
          // latest version
          if (new Date(gsdbRelease.published) > new Date(latest[version].published)) {
            latest[version] = gsdbRelease;
            data[version].version = gsdbRelease.version;
          }
        }

        data[version].versions.push(gsdbRelease);
      });
    });

    // Attempt to find any missing PHP versions
    noPhpVersions.forEach((descriptor) => {
      let { pmVersion, minecraftVersions } = descriptor;
      let phpVersion = this.getFallbackPhpVersion(data, pmVersion);
      minecraftVersions.forEach((mcVersion) => {
        for (let i = 0; i < data[mcVersion].versions.length; i++) {
          if (data[mcVersion].versions[i].version === pmVersion) {
            data[mcVersion].versions[i].php = phpVersion;
            break;
          }
        }
      });
    });

    return data;
  }

  getFallbackPhpVersion(data, pmVersion) {
    for (const rule of DEFAULT_PM_PHP_VERSIONS) {
      if (new RegExp(rule.pm).test(pmVersion)) {
        this.log(`PocketMine ${pmVersion}: falling back to PHP ${rule.php} (via rule)`);
        return rule.php;
      }
    }

    this.log(`PocketMine ${pmVersion}: falling back to PHP ${FALLBACK_PHP_VERSION} (default)`);
    return FALLBACK_PHP_VERSION;
  }

  async scrape(callback) {
    const github = await this.scrapeGH();
    if (github.err) {
      return callback(github.err);
    }

    this.request('https://poggit.pmmp.io/pmapis', {
        format: 'json',
        timeout: 10000
      },
      (err, data) => {
        if (err) {
          this.log(`Error retrieving Poggit data: ${err}`);
          this.log('All PHP versions will fall back to defaults.');
          data = {};
        }

        try {
          return callback(null, this.process({
            github: github.result,
            poggit: data
          }));
        } catch (err) {
          console.log('Error while processing');
          return callback(err);
        }
      });
  }
}
