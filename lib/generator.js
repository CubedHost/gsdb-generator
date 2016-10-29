import path from 'path';
import async from 'async';
import debug from 'debug';
import mongodb from 'mongodb';

const log = debug('gen');

class Generator {

  constructor({ mongo, sourcesPath, oldPackageThreshold }) {
    this.databaseReady = false;
    this.sources = [ ];

    this.mongoUri = mongo || 'mongodb://127.0.0.1:21707/gsdb';
    this.sourcesPath = sourcesPath || 'sources';
    this.oldPackageThreshold = oldPackageThreshold || 604800;
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

    // Fetch package data array from source
    source.scrape(onScrapeComplete);

    // Run prepareInsert() for each package, finish in onPrepareComplete()
    function onScrapeComplete(err, data) {
      if (err) {
        log(err);
        return callback();
      }

      data = data || [];
      async.each(data, prepare, onPrepareComplete);
    }

    // Lookup existing packages; insert if new; update if exists
    // Takes place within onScrapeComplete async.each
    function prepare(pack, cb) {
      packages.find({ _id: pack._id }).toArray(
        function(err, docs) {
          actions.push({
            'pack': pack,
            'update': (docs.length > 0)
          });

          cb(err);
        }
      );
    }

    //
    function onPrepareComplete(err) {
      if (err) return callback(err);

      async.each(actions, processAction, callback);
    }

    //
    function processAction(action, cb) {
      action.pack._last_seen = Math.floor(Date.now() / 1000);
      action.pack._active = true;

      if (action.update) {
        packages.update({ '_id': action.pack._id }, action.pack, cb);
      } else {
        packages.insert(action.pack, cb);
      }
    }

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

}

export default Generator;
