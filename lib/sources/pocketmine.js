import Source from './base';

export default class PocketMineSource extends Source {

  constructor(...params) {
    super(...params);

    this.packages = {};
  }

  process(apiVersions) {
    Object
      .keys(apiVersions)
      // build server types
      .forEach(key => this.buildPocketMinePackage(key, apiVersions[key]));

    return Object.values(this.packages);
  }

  buildPocketMinePackage(apiVersion, [ data ]) {
    const majorVersion = apiVersion.split('-')[0];

    if (!/([0-9]\.?){3}/.test(majorVersion)) {
      this.log(`Skipping invalid API version: ${apiVersion}`);
      return;
    } else if (data.phar && !data.phar.default) {
      data.phar = {
        default: `https://github.com/pmmp/PocketMine-MP/releases/download/${apiVersion}/PocketMine-MP.phar`
      }
    } else if (!data.phar || !data.phar.default) {
      this.log(`Skipping version with no origin: ${apiVersion}`);
      return;
    }

    const packageKey = majorVersion.replace(/(\.0)+$/g, '');

    const gsdbVersion = {
      version: apiVersion,
      origin: data.phar ? data.phar.default : undefined,
      php: data.php
    };

    // Package exists, add a version
    if (this.packages[packageKey]) {
      this.packages[packageKey].versions.push(gsdbVersion);
      return;
    }

    const source = this.id;
    const _id = `${this.id}-${packageKey}`;
    const name = `${this.name} ${majorVersion}`;

    const pmmpPackage = {
      _id,
      name,
      source,
      version: apiVersion,
      versions: [ gsdbVersion ]
    };

    this.packages[packageKey] = pmmpPackage;
  }

}
