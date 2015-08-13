import url from 'url';
import async from 'async';
import debug from 'debug';
import BaseSource from '../lib/BaseSource';

const log = debug('gen:source:technic');

const SERVER_MAPPINGS = {
  'attack-of-the-bteam': 'bteam/BTeam_Server_v',
           'tekkitmain': 'tekkitmain/Tekkit_Server_v',
               'tekkit': 'tekkit/Tekkit_Server_',
               'bigdig': 'bigdig/BigDigServer-v',
               'hexxit': 'hexxit/Hexxit_Server_v',
                'voltz': 'voltz/Voltz_Server_v',
           'tekkitlite': 'tekkitlite/Tekkit_Lite_Server_',
           'blightfall': 'Blightfall_Server_v',
                 'tppi': 'TPPIServer-v'
};

class TechnicSource extends BaseSource {

  constructor(name, url, options) {
    super(name, url, options);
  }

  fetch(callback) {
    super.request('', { }, (err, data) => {
      if (err) return callback(err);

      if (typeof data === 'undefined') {
        return callback(new Error('Received invalid response'));
      } else if (typeof data.modpacks === 'undefined') {
        return callback(new Error('Received no modpack data'));
      }

      let modpacks = Object.keys(data.modpacks);

      async.map(modpacks, (key, cb) => {
        let path = 'modpack/' + key;

        super.request(path, cb);
      }, (err, results) => {
        if (err) return callback(err);

        results = { modpacks: results };
        results.mirror_url = data.mirror_url;
        callback(null, results);
      });
    });
  }

  process(data) {
    let { modpacks } = data;
    let mirrorUrl = data.mirror_url;

    let packages = [ ];

    modpacks.forEach((originalPack) => {
      if (this.ignoredPackages.indexOf(originalPack.name) !== -1) {
        log('Skipping ignored package: %s', originalPack.name);
        return;
      } else if (Object.keys(SERVER_MAPPINGS).indexOf(originalPack.name) === -1) {
        log('No server pack found: %s', originalPack.name);
        return;
      }

      let serverPath = SERVER_MAPPINGS[originalPack.name];

      let id = originalPack.name
        .toLowerCase()
        .replace(/tekkitmain$/, 'tekkit');

      let pattern = `^{this.id}-{id}(?:[.-]([\\d.]+))?\\.jar$`;
      pattern = new RegExp(pattern);

      let origin = url.resolve(mirrorUrl, serverPath) + '{VERSION}.zip';

      let pack = {
               _id: this.id + '-' + id,
              name: originalPack.display_name,
        visibility: 'public',
            source: this.id,
           version: originalPack.recommended,
          versions: [ ],
           pattern,
           origin
      };

      originalPack.builds.forEach((version) => {
        pack.versions.push({ version });
      });

      packages.push(pack);
    });

    return packages;
  }

}

export default TechnicSource;
