import path from 'path';
import url from 'url';
import debug from 'debug';
import request from 'node-fetch';
import { loadJson } from '../util';
import GameVersion from '../models/GameVersion';
import Platform from './Platform';
import Axios from 'axios';
import Cheerio from 'cheerio';

// Example: https://minecraft.azureedge.net/bin-linux/bedrock-server-1.14.32.1.zip
const BEDROCK_URL_REGEX = /https:\/\/minecraft\.azureedge\.net\/bin-linux\/bedrock-server-(?<version>[0-9\.]+)\.zip/i;

class MinecraftBedrockPlatform extends Platform {
  async fetch() {
    return ::this.request();
  }

  async request(path, options = { }) {
    try {
      const data = await Axios.get(this.url);
      const $ = Cheerio.load(data.data);
      return $('a[data-platform="serverBedrockLinux"]').attr('href');
    } catch (err) {
      this.log(err);
    }
  }

  filter(pkg) {
    return true;
  }

  async process(data) {
    const regexParser = data.match(BEDROCK_URL_REGEX);

    if (regexParser && !regexParser.groups && !regexParser.groups.version) {
      this.log('Invalid link:', data);
      return {
        packages: [],
        meta: {}
      };
    }

    if (this.packages.find(ep => ep.version === regexParser.groups.version)) {
      return {
        packages: [],
        meta: {}
      };
    }

    const gameVer = await ::this.findGameVersion(this, regexParser.groups.version);

    // @TODO: Be a tad bit more graceful.
    try {
      const pkgEntry = this.packages[gameVer.id].versions.find(ep => `${ep.version}` === `${version.id}`);
      if (pkgEntry && pkgEntry.origin) return { packages: [], meta: {} };
    } catch (err) {
      // Do nothing. 
    }

    return {
      packages: {
        'alpha': {
          versions: [{
            game_version_id: gameVer.id,
            package_id: this.id,
            name: regexParser.groups.version,
            version: regexParser.groups.version,
            origin: data
          }],
          source_ref: 'alpha',
          slug: 'alpha',
          name: 'Bedrock Alpha'
        }
      },
      meta: {}
    }
  }
}

export default MinecraftBedrockPlatform;