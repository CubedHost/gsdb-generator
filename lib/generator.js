import path from 'path';
import async from 'async';
import debug from 'debug';
import md5 from 'md5';
import mongodb from 'mongodb';
import Producer from 'sqs-producer';
import sns from 'sns.js';

const log = debug('gen');

class Generator {

  constructor({ aws, mongo, sourcesPath, oldPackageThreshold }) {
    this.databaseReady = false;
    this.sources = [ ];

    this.mongoUri = mongo || 'mongodb://127.0.0.1:21707/gsdb';
    this.sourcesPath = sourcesPath || 'sources';
    this.oldPackageThreshold = oldPackageThreshold || 604800;

    // AWS configuration
    if (aws.sqs && !aws.sqs.queueUrl) {
      // Error out if SQS config exists but missing URL
      throw new Error('Missing AWS SQS configuration!');
    }

    this.queueUrl = aws.sqs.url;

    process.env.AWS_ACCESS_KEY_ID = aws.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = aws.secretAccessKey;
    process.env.AWS_REGION = aws.region;

    if (aws.sns){
      if (aws.sns.topic) process.env.AWS_SNS_TOPIC = aws.sns.topic;
    }
  }

  run(callback) {
    async.series([
      ::this.init,
      ::this.scrapeSources,
      ::this.prunePackages
    ], (err) => {
      this.close();
      callback(err);
    });
  }

  init(callback) {
    this.initQueue();
    this.initDatabase(() => {
      this.loadSources(callback);
    });
  }

  close() {
    this.dbConnection.close();
  }

  /**
   * Establish MongoDB connection
   *
   * @param  {Function} callback Called on complete or error
   */
  initDatabase(callback) {
    mongodb.connect(this.mongoUri, (err, db) => {
      if (err) {
        log('Failed to connect to database: ' + err);
        return;
      }

      log('Database connection established');
      this.databaseReady = true;
      this.dbConnection = db;

      callback();
    });
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
   *
   * @param  {Function} callback Called on complete or error
   */
  loadSources(callback) {
    let sources = this.sources = [];
    let dbSources = this.dbConnection.collection('sources');

    let requirePath = path.join(__dirname, 'sources');

    dbSources.find().toArray((err, docs) => {
      if (err) return callback(err);

      docs.forEach((sourceConfig) => {
        if (sourceConfig.type === 'dummy') return;

        let sourceFilePath = path.join(requirePath, sourceConfig._id);
        let { name, url } = sourceConfig;

        try {
          let source = new (require(sourceFilePath)['default'])(name, url, sourceConfig);
          sources.push(source);
        } catch (err) {
          log(`Encountered error within ${name} source, skipping`);
          log(err);
        }
      });

      log('Loaded source configurations');
      callback();
    });
  }

  /**
   *
   *
   * @param  {[type]}   source   The source to scrape
   * @param  {Function} callback Called on complete or error
   */
  scrape(source, callback) {
    let packages = this.dbConnection.collection('packages');
    let actions = [];

    log('Scraping source: %s', source.name);

    // Run prepareInsert() for each package, finish in onPrepareComplete()
    let onScrapeComplete = (err, data) => {
      if (err) {
        log(err);
        return callback();
      }

      data = data || [];

      async.eachSeries(data, ::this.detectChanges, () => {
        async.each(data, prepare, onPrepareComplete);
      });
    }

    // Lookup existing packages; insert if new; update if exists
    // Takes place within onScrapeComplete async.each
    let prepare = (pack, cb) => {
      packages.find({ _id: pack._id }).toArray(
        function(err, docs) {
          actions.push({
            'pack': pack,
            'update': (docs.length > 0)
          });

          cb(err);
        }
      );
    };

    //
    let onPrepareComplete = (err) => {
      if (err) return callback(err);

      log('Saving %d changes', actions.length);

      async.eachSeries(actions, processAction, callback);
    };

    //
    let processAction = (action, cb) => {
      action.pack._last_seen = Math.floor(Date.now() / 1000);
      action.pack._active = true;

      if (action.update) {
        packages.update({ '_id': action.pack._id }, action.pack, cb);
      } else {
        packages.insert(action.pack, cb);
      }

    };

    // Fetch package data array from source
    source.scrape(onScrapeComplete);
  }

  /**
   *
   */

  prunePackages(callback) {
    log('Pruning old packages');

    let dbPackages = this.dbConnection.collection('packages');

    dbPackages.find({ }, { _id: 1, _last_seen: 1 }).toArray((err, packages) => {
      if (err) return callback(err);

      packages.forEach((pack) => {
        let timestamp = Math.floor(Date.now() / 1000);
        let active = true;

        if (typeof pack._last_seen === 'undefined') {
          active = false;
        } else if (timestamp - pack._last_seen >= this.oldPackageThreshold) {
          active = false;
        }

        dbPackages.update({ _id: pack._id }, { '$set': { _active: active } });

        if (!active) log(`Marked ${pack._id} as inactive`);
      });

      log('Inactive packages pruned');
      callback();
    });
  }

  /**
   * Iterates through sources and calls scrape funtion on each.
   *
   * @param {Function} callback
   */
  scrapeSources(callback) {
    let { sources } = this;

    log('Scraping all sources');

    if (typeof sources === 'undefined') {
      return callback(new Error('No sources loaded'));
    }

    async.eachSeries(
      sources,
      this.scrape.bind(this),
      function (err) {
        if (err) {
          log(err);
        }

        log('Scrape completed');
        callback(err);
      }
    );
  }

  detectChanges(newPackage, callback) {
    if (!this.queue) return callback();

    let dbPackages = this.dbConnection.collection('packages');
    let { _id, source } = newPackage;

    // Skip Curse packages
    if (source === 'curse') return callback();

    dbPackages
      .find({ _id })
      .toArray((err, [ oldPackage ]) => {
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
          if (typeof version === 'object') version = version.version;
          let isNew = !(version in oldVersions);

          // Skip if no change in versions
          if (typeof version !== 'undefined' && !isNew) return false;

          return true;
        });

        newVersions = newVersions.map(
          version => typeof version === 'object' ? version.version : version
        );

        // Check for an existing version being promoted to recommended
        if (oldPackage.version !== newPackage.version) {
          if (!~newVersions.indexOf(newPackage.version)) {
            newVersions.push(newPackage.version);
          }
        }

        // Enqueue builds
        newVersions.forEach(version => this.enqueueBuild(newPackage, version));

        callback();
      });
  }

  enqueueBuild(pkg, version) {
    let { _id } = pkg;

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
