import async from 'async';
import Source from './base';
import JenkinsSource from './jenkins';

const JobListURL = 'https://papermc.io/ci/'

export default class PaperSource extends Source {

  constructor(...params) {
    super(...params);

    this.jobs = [];
  }

  fetch(callback) {
    async.waterfall([
      next => this.fetchJobList(next),
      (jobs, next) => this.scrapeJobs(jobs, next)
    ], callback);
  }

  fetchJobList(callback) {
    this.request(`${JobListURL}/api/json`, (err, res) => {
      if (err) return callback(err);

      if (!res || !res.jobs) {
        return callback(new Error(`Got invalid response from PaperMC Jenkins: ${res}`));
      }

      return callback(null, res.jobs);
    });
  }

  scrapeJobs(jobs, callback) {
    async.map(
      jobs,
      (job, next) => this.scrapeJob(job.name, next),
      (err, results) => {
        if (err) return callback(err);
        callback(null, this.combineJobResults(results));
      }
    );
  }

  fetchJob(id, callback) {
    this.request(`${JobListURL}/job/${id}/api/json`, callback);
  }

  scrapeJob(jobName, callback) {
    this.fetchJob(jobName, (err, jobData) => {
      if (err) {
        this.log(`Failed to fetch job: ${jobName}`);
        this.log(err);
        return callback(null, []);
      }

      const jobFullName = jobData.fullDisplayName;
      this.log(`Scraping job: ${jobFullName}`);

      let job;

      // Pre-1.13 job ID with builds for older MC versions
      if (jobName === 'Paper') {
        job = new OldPaperJob(this.name, jobData.url, this.options);
      } else
      // New Paper builds for 1.13+
      {
        const nameMatch = /^\s*Paper-((?:[0-9]+\.?){3})/.exec(jobFullName);
        if (!nameMatch || nameMatch.length < 2) {
          this.log(`Invalid job name: ${jobFullName}`);
          return callback(null, []);
        }

        const minecraftVersion = nameMatch[1];
        job = new PaperJob(minecraftVersion, this.name, jobData.url, this.options);
      }

      job.scrape((err, results) => {
        // Log errors but don't report back, so that jobs can fail separately
        if (err) {
          this.log(`Failed to scrape job: ${jobFullName}`);
          this.log(err);
        }

        callback(null, err ? [] : results);
      });
    });
  }

  combineJobResults(results) {
    return results
      .filter(_ => _)
      .reduce((a, b) => a.concat(b));
  }

  process(data) {
    return data;
  }

}

class OldPaperJob extends JenkinsSource {

  constructor(...params) {
    super(...params);

    this.pomRegex = /^paper(spigot)?.*\.pom$/;
  }

  getModule(build) {
    if (build < 444) return 'org.github.paperspigot$paperspigot';
    return 'com.destroystokyo.paper$paper';
  }

  mapMinecraftVersion(build, id, callback) {
    if (parseInt(id) >= 1516) {
      build.minecraftVersion = '1.12.2';
      this.packages['1.12.2'].push(build);
      return callback();
    }

    return super.mapMinecraftVersion(build, id, callback);
  }

}

class PaperJob extends JenkinsSource {

  constructor(minecraftVersion, ...params) {
    super(...params);

    this.minecraftVersion = minecraftVersion;
  }

  mapMinecraftVersions(callback) {
    const builds = Object
      .values(this.builds)
      .map(build => {
        build.minecraftVersion = this.minecraftVersion;
        return build;
      });

    this.packages = {
      [`${this.minecraftVersion}`]: builds
    };

    return callback();
  }

}
