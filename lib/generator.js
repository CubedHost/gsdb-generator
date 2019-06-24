import path from 'path';
import debug from 'debug';
import md5 from 'md5';
import { MongoClient } from 'mongodb';
import Producer from 'sqs-producer';
import sns from 'sns.js';
import { isEqual } from 'lodash';

const log = debug('gen');

class Generator {

  constructor({ aws, mongo, sourcesPath, oldPackageThreshold }) {
    this.databaseReady = false;
    this.sources = [ ];

    this.mongoUri = mongo || 'mongodb://127.0.0.1:21707/gsdb';
    this.sourcesPath = sourcesPath || 'sources';
    this.oldPackageThreshold = oldPackageThreshold || 604800;

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
      await this.init();
      await this.scrapeSources();
      await this.prunePackages();
    } catch (err) {
      log(err);
    }

    await this.close();
  }

  async init() {
    this.initQueue();
    await this.initDatabase();
    return await this.loadSources();
  }

  async close() {
    return this.dbClient.close();
  }

  /**
   * Establish MongoDB connection
   */
  async initDatabase() {
    const databaseName = this.mongoUri.split('/').pop().split('?').shift();

    try {
      const client = await MongoClient.connect(this.mongoUri);
      log('Database connection established');
      this.databaseReady = true;
      this.dbClient = client;
      this.dbConnection = client.db(databaseName);
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
    let sources = this.sources = [];
    let dbSources = this.dbConnection.collection('sources');

    let requirePath = path.join(__dirname, 'sources');

    const docs = await dbSources.find().toArray();
    docs.forEach((sourceConfig) => {
      if (sourceConfig.type === 'dummy') return;

      let sourceFilePath = path.join(requirePath, sourceConfig._id);
      let { name } = sourceConfig;

      try {
        let source = new (require(sourceFilePath)['default'])(name, sourceConfig);
        sources.push(source);
      } catch (err) {
        log(`Encountered error within ${name} source, skipping`);
        log(err);
      }
    });
  }

  /**
   *
   *
   * @param  {[type]}   source   The source to scrape
   * @param  {Function} callback Called on complete or error
   */
  async scrape(source) {
    return new Promise((resolve, reject) => {
      const packages = this.dbConnection.collection('packages');
      const sourcesMeta = this.dbConnection.collection('sources_meta');
      let actions = [];

      log('Scraping source: %s', source.name);

      // Run prepareInsert() for each package, finish in onPrepareComplete()
      let onScrapeComplete = async (err, data) => {
        if (err) {
          return reject(err);
        }

        try {
          data = data || [];
          const dataPackages = Array.isArray(data.packages)
            ? data.packages : Object.values(data.packages);

          for (const pkg of dataPackages) {
            await this.detectChanges(pkg);

            // Lookup existing packages; insert if new; update if exists
            const dbPkgCount = await packages.count({ _id: pkg._id });
            await processAction({
              pack: pkg,
              update: dbPkgCount > 0
            });
          }

          if (Object.keys(data.meta).length > 0) {
            log('Updating source meta');
            await sourcesMeta.updateOne({_id: source.id}, {'$set': data.meta}, {upsert: true});
          }

          resolve();
        } catch (err) {
          reject(err);
        }
      };

      const processAction = async (action) => {
        action.pack._last_seen = Math.floor(Date.now() / 1000);
        action.pack._active = true;

        if (action.update) {
          return await packages.updateOne({ '_id': action.pack._id }, { '$set': action.pack });
        } else {
          return await packages.insertOne(action.pack);
        }
      };

      // Fetch package data array from source
      source.scrape(onScrapeComplete);
    });
  }

  /**
   *
   */

  async prunePackages() {
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
        await this.scrape(source);
      } catch (err) {
        log(`Error while scraping source: ${err}`);
        log(err);
      }
    }

    log('Scrape completed');
  }

  async detectChanges(newPackage) {
    return new Promise((resolve) => {
      const dbPackages = this.dbConnection.collection('packages');
      const { _id } = newPackage;

      dbPackages
        .find({ _id })
        .toArray((err, [oldPackage]) => {
          if (err) return log(err);
          if (!oldPackage) oldPackage = { versions: [] };

          // Convert array to object
          let oldVersions = oldPackage.versions || {};
          if (Array.isArray(oldPackage.versions)) {
            (oldPackage.versions || []).forEach((version) => {
              oldVersions[version.version] = version;
            });
          }

          let newVersions = newPackage.versions || [];
          newVersions = newVersions && !Array.isArray(newVersions) ?
            Object.keys(newVersions) :
            newVersions;

          // Check for newly added versions
          newVersions = newVersions.filter((version) => {
            let id;

            if (typeof version === 'object') {
              id = version.version;
            } else {
              id = version;
              version = newPackage.versions[id];
            }

            let oldVersion = oldVersions[id];

            let hasChanged = !isEqual(version, oldVersion);
            let isNew = !(id in oldVersions);

            // Skip if no change in versions
            if (typeof id !== 'undefined' && !isNew && !hasChanged) {
              return false;
            }

            log(`New version for '${newPackage._id}': ${id}`);
            log(`hasChanged: ${hasChanged}, isNew: ${isNew}`);
            return true;
          });

          newVersions = newVersions.map(
            version => typeof version === 'object' ? version.version : version
          );

          // Check for an existing version being promoted to recommended
          if (`${oldPackage.version}` !== `${newPackage.version}`) {
            if (!~newVersions.indexOf(newPackage.version)) {
              log(`Recommended version changed for '${newPackage._id}': `
                + `${newPackage.version}`);

              newVersions.push(newPackage.version);
            }
          }

          // Enqueue builds
          newVersions.forEach(version => this.enqueueBuild(newPackage, version));

          resolve();
        });
    });
  }

  enqueueBuild(pkg, version) {
    let { _id } = pkg;

    if (!this.queue) {
      log(`Skipping enqueue for ${_id} ${version}`);
      return;
    }

    log(JSON.stringify(pkg, null, 2));

    // Generate unique message ID from md5 digest of package ID + version
    //
    // This is unique to the specific package and version, but should
    // avoid duplication within the SQS queue if the generator runs
    // multiple times before the builder can dequeue the message.
    let messageId = md5(`${_id}-${version}`);

    // Create message body from package object with specific version
    let message = Object.assign({}, pkg);
    message.id = message._id;
    message.version = version;

    let body = JSON.stringify(message);

    // Enqueue!
    this.queue.send({
      id: messageId,
      groupId: 'gsdb',
      deduplicationId: messageId,
      body
    }, (err) => {
      if (err) log(err);
    });

    // Notify via SNS if available
    let { AWS_SNS_TOPIC } = process.env;
    if (AWS_SNS_TOPIC) {
      sns.publish(AWS_SNS_TOPIC, message)
         .then(() => log(`Notified via SNS: ${message.id}-${version}`))
         .catch((err) => log(err));
     }
  }

}

export default Generator;
