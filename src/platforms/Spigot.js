import url from 'url';
import async from 'async';
import { sortVersions } from '../util';
import Platform from './Platform';
import Cheerio from 'cheerio';

const HUB_PATH = 'https://hub.spigotmc.org/';
const VERSIONS_PATH = `${HUB_PATH}versions/`;
const BUILD_DATA_CACHE = { };

class SpigotPlatform extends Platform {
  project = 'spigot';

  get stashUrl() {
    let project = this.project.toUpperCase();
    let path = `/stash/projects/${project}/repos/builddata/`;

    return url.resolve(HUB_PATH, path);
  }

  async fetch() {
    try {
      const packages = await ::this.request();
      const builds = await ::this.fetchBuildList();
      const buildData = await ::this.addBuildData(builds);
      return buildData.filter(item => !(this.packages[item.minecraftVersion] || { versions: [] }).versions.find(ep => `${ep.version}` === `#${item.name}`));
    } catch (err) {
      throw err;
    }
  }

  async fetchBuildList() {
    this.log('Fetching build list & references from Spigot Hub');

    try {
      const buildScrape = await ::this.request(VERSIONS_PATH);
      const $ = Cheerio.load(buildScrape);
      const builds = $('pre a').toArray().map(o => o.attribs.href).filter(Boolean);

      return builds
        .filter((filename) => filename.match(/^[0-9]+\.json$/))
        .map((filename) => {
          const name = filename.replace(/\.json$/, '');

          try {
            return parseInt(name);
          } catch (err) {
            return false;
          }
        })
        .filter(Boolean)
        .sort((a, b) => a - b);
    } catch (err) {
      throw err;
    }
  }

  async addBuildData(builds) {
    const result = [];

    for (const buildId of builds) {
      const build = await ::this.getBuild(buildId);
      if (!build.refs.BuildData) continue;

      // @TODO: Handle a tad better. Works for now?
      // If Atlassian Stash redirects us to a login, we won't obtain a JSON object.
      // If we don't have an object, the build data couldn't be found.
      const buildData = await ::this.getBuildData(build.refs.BuildData);
      if (typeof buildData !== 'object') continue;

      build.minecraftVersion = buildData.minecraftVersion;
      result.push(build);
    }

    return result;
  }

  async getBuild(version) {
    const key = `build_${version}`;
    const itemCache = await ::this.getFromCache(key);

    if (itemCache) {
      return itemCache;
    }

    const value = await this.request(`${VERSIONS_PATH}${version}.json`);
    await this.putCache(key, value);
    return value;
  }

  async getBuildData(commitHash) {
    const key = `build_data_${commitHash}`;
    const itemCache = await ::this.getFromCache(key);

    if (itemCache) {
      return itemCache;
    }

    const value = await ::this.request(`${this.stashUrl}raw/info.json?at=${commitHash}`, { location: 'manual', headers: { referer: `https://hub.spigotmc.org/stash/projects/SPIGOT/repos/builddata/browse/info.json` }});
    await ::this.putCache(key, value);
    return value;
  }

  async process(data) {
    let packages = [ ];

    for (const version of data) {
      try {
        const gameVer = await ::this.findGameVersion(this, version.minecraftVersion);
        if (!gameVer) continue;

        if (typeof packages[gameVer.id] === 'undefined') {
          packages[gameVer.id] = {
            versions: [],
            name: `${this.name} ${version.minecraftVersion}`,
            slug: version.minecraftVersion,
            source_ref: version.minecraftVersion
          };
        }

        packages[gameVer.id].versions.push({
          package_id: this.id,
          game_version_id: gameVer.id,

          name: `#${version.name}`,
          version: version.name,

          origin: `https://hub.spigotmc.org/versions/${version.name}.json`,
          created_at: version.created_at
        });
      } catch (err) {
        this.log(err.message, this.options, version.minecraftVersion);
        // Do nothing.
      }
    }

    return {
      packages: packages,
      meta: {}
    };
  }
}

export default SpigotPlatform;
