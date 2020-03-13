import path from 'path';
import debug from 'debug';
import md5 from 'md5';
import Producer from 'sqs-producer';
import sns from 'sns.js';
import Database from './utils/Database';
import SourceModel from './models/Source';
import Package from './models/Package';
import Platforms from './platforms';
import { runInThisContext } from 'vm';
import PackageVersion from './models/PackageVersion';

const log = debug('gen');

class Generator {
  sources = [ ];
  oldPackageThreshold = 604800;


  constructor() {
    const { aws } = global.config;

    if (aws) {
      // AWS configuration
      if (aws.sqs) {
        // Error out if SQS config exists but missing URL
        if (!aws.sqs.url) throw new Error('Missing AWS SQS configuration!');

        this.queueUrl = aws.sqs.url;
      }

      process.env.AWS_ACCESS_KEY_ID = aws.accessKeyId;
      process.env.AWS_SECRET_ACCESS_KEY = aws.secretAccessKey;
      process.env.AWS_REGION = aws.region;

      if (aws.sns) {
        if (aws.sns.topic) process.env.AWS_SNS_TOPIC = aws.sns.topic;
      }
    }
  }

  async run() {
    try {
      await ::this.init();
      await ::this.scrapeSources();
      await ::this.prunePackages();
    } catch (err) {
      log(err);
    }

    await this.close();
  }

  async init() {
    this.initQueue();
    await this.initDatabase();
    this.sources = await ::this.loadSources();
  }

  async close() {
    return Database.close();
  }

  /**
   * Establish MongoDB connection
   */
  async initDatabase() {
    try {
      Database.init();
    } catch (err) {
      log('Failed to connect to database: ' + err);
    }
  }

   initQueue() {
     if (!this.queueUrl) return;

     this.queue = Producer.create({
       queueUrl: this.queueUrl
     });
   }

  /**
   * Loads package source names from MongoDB, then loads the corresponding local module.
   * Sources contain logic for fetching, parsing, and inserting data related to each package source.
   */
  async loadSources() {
    const sources = [];
    let dbSources = await SourceModel.query().where({ active: true }).withGraphFetched('*');

    for (const sourceConfig of dbSources) {
      if (sourceConfig.type === 'dummy') return;

      try {
        const source = Platforms[sourceConfig.platform];

        if (!source) {
          log(`No such platform: ${sourceConfig.platform}`);
          continue;
        }

        sources.push(new source.default(sourceConfig.name, sourceConfig));
      } catch (err) {
        log(`Encountered error within ${sourceConfig.name} source, skipping`);
        log(err);
      }
    }

    return sources;
  }

  /**
   * @param  {[type]}   source   The source to scrape
   */
  async scrape(source) {
    const { packages } = source;

    log('Scraping source: %s', source.name);

    // Fetch package data array from source
    const data = await ::source.scrape() || { packages: {}, meta: {} };
    for (const pkgId in data.packages) {
      const pkg = data.packages[pkgId];
      pkg.source = source.slug;
      pkg.type = source.package_type;

      try {
        const oldPkg = packages.find(p => `${p.source_ref}` === `${pkg.source_ref}` && p.name === pkg.name) || { versions: [] };

        //pkg.updated_at = Math.floor(Date.now() / 1000);
        pkg.active = true;

        const fieldsToKeep = ['source_id', 'source_ref', 'name', 'slug', 'active', 'updated_at'];
        const pkgDb = { };

        for (const k of fieldsToKeep) {
          if (!pkg[k]) continue;
          if (pkg[k]) pkgDb[k] = pkg[k];
        }

        const thisPackage = await Package.query().upsertGraph({
          id: oldPkg ? oldPkg.id : undefined,
          'source_id': source.id,
          ...pkgDb
        }, { insertMissing: true, relate: true, noDelete: true, unrelate: true });

        if (oldPkg && pkg.versions && oldPkg.versions) {
          pkg.versions = pkg
            .versions
            .filter(p => typeof oldPkg.versions.find(o => o.version === p.version) === 'undefined')
            .map(p => {
              try {
                p.id = oldPkg.versions.find(o => `${o.version}` === `${p.version}`).id;
              } catch(err) {}

              p.package_id = thisPackage.id;
              return p;
            });

          for (const version of pkg.versions) {
            const existingPkgVer = (thisPackage.versions || []).find(pv => pv.package_id === version.package_id && pv.game_version_id === version.game_version_id && pv.version === version.version);
            if (existingPkgVer) {
              version.id = existingPkgVer.id;
            } else {
              if (typeof version.origin === 'function') {
                let retries = 0;

                do {
                  try {
                    version.origin = await version.origin();
                    break;
                  } catch (err) {
                    log(`Encountered an error while trying to fetch the server download. Sleeping for a few seconds and retrying.`);
                    await new Promise(resolve => setTimeout(resolve, retries * 1000 * (Math.random() * 500)));
                  } finally {
                    if (retries >= 3) {
                      log(`Retry limit exceeded for server download. Skipping version ${version.id} for ${pkg.id}`);
                      continue;
                    }
                  }
                  retries++;
                } while(retries <= 3);
              }
            }

            await PackageVersion.query().upsertGraph(version, { noDelete: true, relate: true, unrelate: true, insertMissing: true });
          }
        }

        const newVersions = await ::this.detectChanges(oldPkg, pkg);
      } catch (err) {
        log(err);
      }
    }

    if (Object.keys(data.meta).length > 0) {
      log('Updating source meta', data.meta);
      //await sourcesMeta.updateOne({_id: source.id}, {'$set': data.meta}, {upsert: true});
    }
  }

  /**
   *
   */

  async prunePackages() {
    return;
    return new Promise((resolve, reject) => {
      log('Pruning old packages');

      let dbPackages = this.dbConnection.collection('packages');

      dbPackages.find({}, {
        _id: 1,
        _last_seen: 1
      }).toArray()
        .then((packages) => {
          packages.forEach(async (pack) => {
            let timestamp = Math.floor(Date.now() / 1000);
            let active = true;

            if (typeof pack._last_seen === 'undefined') {
              active = false;
            } else if (timestamp - pack._last_seen >= this.oldPackageThreshold) {
              active = false;
            }

            await dbPackages.updateOne({ _id: pack._id }, { '$set': { _active: active } });

            if (!active) log(`Marked ${pack._id} as inactive`);
          });
        })
        .then(() => {
          log('Inactive packages pruned');
          resolve();
        })
        .catch(reject);
    });
  }

  /**
   * Iterates through sources and calls scrape funtion on each.
   *
   * @param {Function} callback
   */
  async scrapeSources() {
    let { sources } = this;

    log('Scraping all sources');

    if (typeof sources === 'undefined') {
      throw new Error('No sources loaded');
    }

    for (const source of sources) {
      try {
        await ::this.scrape(source);
      } catch (err) {
        log(`Error while scraping source: ${err.message}`);
        log(err);
      }
    }

    log('Scrape completed');
  }

  async detectChanges(oldPackage, newPackage) {
    try {
      if (!oldPackage) oldPackage = { versions: [] };

      // Convert array to object
      let oldVersions = oldPackage.versions || {};

      if (typeof oldPackage.versions === 'array') {
        for (const version of versions) {
          oldVersions[version.version] = version;
        }
      }

      let newVersions = newPackage.versions || [];
      newVersions = newVersions && !Array.isArray(newVersions) ?
        Object.keys(newVersions) :
        newVersions;

      // Check for newly added versions
      for (let verIdx in newVersions) {
        let version = newVersions[verIdx];
        let id;

        if (typeof version === 'object') {
          id = version.version;
        } else {
          id = version;
          version = newPackage.versions[id];
        }

        let oldVersion = oldVersions[id] || { };
        let hasChanged = Object.keys(oldVersion)
          .filter(k => version[k] !== oldVersion[k])
          .filter(k => k === 'origin' && typeof version[k] !== 'function' && version[k] !== oldVersion[k]);

        let isNew = !(id in oldVersions);

        // Skip if no change in versions
        if (typeof id !== 'undefined' && !isNew && !hasChanged) {
          delete newVersions[verIdx];
          continue;
        }

        //log(`New version for '${newPackage._id}': ${id}`);
        //log(`hasChanged: ${hasChanged}, isNew: ${isNew}`);

        if (!hasChanged) {
          delete newVersions[verIdx];
          continue;
        }
      }

      newVersions = newVersions.map(
        version => typeof version === 'object' ? version.version : version
      );

      // Check for an existing version being promoted to recommended
      if (`${oldPackage.version}` !== `${newPackage.version}`) {
        if (!~newVersions.indexOf(newPackage.version)) {
          log(`Recommended version changed for '${newPackage.name}': `
            + `${newPackage.version}`);

          newVersions.push(newPackage.version);
        }
      }

      // Enqueue builds
      log(`Enqueuing ${newVersions.length} versions of ${newPackage.name} for building.`);
      for (const version of newVersions) {
        await ::this.enqueueBuild(newPackage, version);
      }
    } catch (err) {
      log(err);
    }
  }

  async enqueueBuild(pkg, version) {
    let { name } = pkg;

    if (!this.queue) {
      log(`Skipping enqueue for ${pkg.source}-${pkg.slug}-${version}`);
      return;
    }

    //log(JSON.stringify(pkg, null, 2));

    // Generate unique message ID from md5 digest of package ID + version
    //
    // This is unique to the specific package and version, but should
    // avoid duplication within the SQS queue if the generator runs
    // multiple times before the builder can dequeue the message.
    let messageId = md5(`${pkg.source}-${pkg.slug}-${version}`);

    // Create message body from package object with specific version
    let message = Object.assign({}, pkg);
    message.id = `${pkg.source}-${pkg.slug}`;
    message.version = version;

    let body = JSON.stringify(message);

    // Enqueue!
    try {
      this.queue.send([{
        id: messageId,
        body
      }], err => err && log(err));
    } catch (err) {
      log(err);
    }

    // Notify via SNS if available
    let { AWS_SNS_TOPIC } = process.env;

    if (AWS_SNS_TOPIC) {
      try {
        await sns.publish(AWS_SNS_TOPIC, message);
      } catch (err) {
        log(err);
      }
    }
  }
}

export default Generator;
