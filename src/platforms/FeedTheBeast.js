import Platform from './Platform';
import XmlParser from 'fast-xml-parser';

class FeedTheBeastPlatform extends Platform {

  async fetch() {
    const data = await ::this.request('static/modpacks.xml', {});
    return XmlParser.parse(data);
  }

  async process(data) {
    console.log(data);
    if (typeof data === 'undefined' ||
        typeof data.modpacks === 'undefined' ||
        typeof data.modpacks.modpack === 'undefined') {
      this.log('Encountered error while processing data: invalid data');
      return null;
    }

    const packages = { };

    for (const originalPack of data.modpacks.modpack) {
      originalPack = originalPack.$;

      if (this.ignoredPackages.includes(originalPack.dir)) {
        this.log('Skipping ignored package: %s', originalPack.name);
        continue;
      }

      // Skip if no server download exists
      if (typeof originalPack.serverPack === 'undefined' ||
          originalPack.serverPack === null ||
          originalPack.serverPack.length === 0) {
        this.log('Skipping pack with no server download: %s', originalPack.name);
        continue;
      }

      var id =
        originalPack.dir
        .replace(/(FTBPresents|FTB|ftb_)/g, 'ftb-')
        .replace(/([a-z])_([A-Z])/g, '$1-$2')
        .replace(/_(\d+)_(\d+)_(\d+)$/g, '-$1.$2.$3')
        .replace(/_(\d+)_(\d+)$/g, '-$1.$2')
        .replace(/_(\d)(\d)$/g, '-$1.$2')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/([a-z])_(\d+)/g, '$1$2')
        .toLowerCase();

      id = (id.substr(0, 4) !== 'ftb-' ? 'ftb-' + id.replace(/ftb-/g, '') : id);

      var pattern = new RegExp(id + '(?:[.-]([\\d.]+))?\\.jar');

      var currentVersion = originalPack.version;
      const pack = {
        versions: [],
        name: originalPack.name,
        source_ref: originalPack.name,
      };

      var versionNumbers = [];

      if (originalPack.oldVersions) {
        versionNumbers = originalPack.oldVersions.split(';');
      }

      if (versionNumbers[0] !== currentVersion) {
        versionNumbers = [ currentVersion ].concat(versionNumbers);
      }

      versionNumbers.forEach(
        function addVersions(version) {
          if (version.length <= 0) return;

          pack.versions.push(generateVersion(originalPack, version));
        }
      );

      packs.push(pack);
      }

    return {
      packages: packs,
      meta: {}
    };
  }
}

export default FeedTheBeastPlatform;

/**
 * Provides a version descriptor object for individual versions of FTB modpacks
 *
 * @param {Object} pack    Original modpack descriptor object
 * @param {String} version Version number
 * @returns {Object} Version descriptor
 */
function generateVersion(pack, version) {
  return {
    id: version,
    'version': version,
    'minecraftVersion': pack.mcVersion
  };
}
