import GitHubSource from './github';
import async from 'async';

const MINECRAFT_VERSION_REGEX = /^\*\*For ([\w: ]+) ((?:(?:[\d.]+)(?:[\w ]+)?(?:, )?)+)\*\*$/g;
const POCKETMINE_VERSION_REGEX = /^PocketMine(?:-MP)? ([\w\d.-]+)(?: "[\w ]+")?(?: with API (.+))?$/g;
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
    const { github } = result;
    const poggit = result.poggit[0];
    const sourceId = this.id;
    const data = {};

    // mcVersion (x.y.z) => gsdbRelease struct
    const latest = {};

    github.forEach((release) => {
      const {
        editionName,
        minecraftVersions,
        pmApiVersion,
        pmVersion
      } = PocketMineSource.getReleaseVersionInfo(release);

      let phpVersion;
      if (poggit[pmApiVersion]) {
        phpVersion = poggit[pmApiVersion].php[0];
      } else {
        phpVersion = this.getFallbackPhpVersion(pmVersion);
      }

      const gsdbRelease = {
        version: pmVersion,
        php: phpVersion,
        published: release.published_at,
        minecraftVersions: minecraftVersions,
        origin: PocketMineSource.getPharDownloadLink(release.assets)
      };

      if (gsdbRelease.origin === undefined) {
        this.log(`No assets for release ${gsdbRelease.version} - skipping.`);
        return;
      }

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

    return data;
  }

  static getReleaseVersionInfo(release) {
    const pmFullVersion = new RegExp(POCKETMINE_VERSION_REGEX).exec(release.name);
    let pmApiVersion = pmFullVersion[2] ? pmFullVersion[2] : pmFullVersion[1];
    let pmVersion = pmFullVersion[1];

    // Fall back to the tag if we somehow can't find the version in the title
    pmApiVersion = pmApiVersion || release.tag_name;
    pmVersion = pmVersion || release.tag_name;

    const versionLine = release.body.split('\n')[0].trim();
    const match = new RegExp(MINECRAFT_VERSION_REGEX).exec(versionLine);
    let editionName = match[1] || 'Minecraft: Bedrock Edition';

    // Handle PocketMine versions that display support for multiple
    // Minecraft versions by adding the release info to all of the
    // supported Minecraft versions
    let minecraftVersions = [];
    if (match[2]) {
      minecraftVersions = match[2].split(', ')
        .map((v) => v.replace(' ', '-'));
    }

    return {
      editionName,
      minecraftVersions,
      pmVersion,
      pmApiVersion
    };
  }

  static getPharDownloadLink(assets) {
    if (assets && assets.length > 0) {
      for (const asset of assets) {
        const assetLink = asset.browser_download_url;
        if (assetLink !== undefined
          && assetLink.substring(assetLink.lastIndexOf('.') + 1) === 'phar') {
          return assetLink;
        }
      }
    }

    return undefined;
  }

  getFallbackPhpVersion(pmVersion) {
    for (const rule of DEFAULT_PM_PHP_VERSIONS) {
      if (new RegExp(rule.pm).test(pmVersion)) {
        this.log(`PocketMine ${pmVersion}: falling back to PHP ${rule.php} (via rule)`);
        return rule.php;
      }
    }

    this.log(`PocketMine ${pmVersion}: falling back to PHP ${FALLBACK_PHP_VERSION} (default)`);
    return FALLBACK_PHP_VERSION;
  }

  fetchRemote(callback) {
    async.parallel({
      github: super.fetchRemote.bind(this),
      poggit: ::this.fetchPoggit
    }, callback);
  }

  fetchPoggit(callback) {
    this.request('pmapis.json', {
      format: 'json',
      timeout: 10000
    }, callback);
  }
}
