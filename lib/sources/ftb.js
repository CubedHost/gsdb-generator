import Source from './base';

class FeedTheBeastSource extends Source {

  fetch(callback) {
    super.request('static/modpacks.xml', {}, callback);
  }

  process(data) {
    if (typeof data === 'undefined' ||
        typeof data.modpacks === 'undefined' ||
        typeof data.modpacks.modpack === 'undefined') {
      this.log('Encountered error while processing data: invalid data');
      return null;
    }

    var packs = [];

    data.modpacks.modpack.forEach((originalPack) => {
        originalPack = originalPack.$;

        if (this.ignoredPackages.indexOf(originalPack.dir) !== -1) {
          this.log('Skipping ignored package: %s', originalPack.name);
          return;
        }

        // Skip if no server download exists
        if (typeof originalPack.serverPack === 'undefined' ||
            originalPack.serverPack === null ||
            originalPack.serverPack.length === 0) {
          this.log('Skipping pack with no server download: %s', originalPack.name);
          return;
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
        var pack = {
          _id: id,
          name: originalPack.name,
          visibility: 'public',
          source: this.id,
          versions: [],
          version: currentVersion,
          metadata: {
            dir: originalPack.dir,
            filename: originalPack.serverPack,
            ftbversion: currentVersion.replace(/\./g, '_')
          },
          pattern: pattern
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
    );

    return {
      packages: packs,
      meta: {}
    };
  }
}

export default FeedTheBeastSource;

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
