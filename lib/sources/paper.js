import async from 'async';
import Source from './base';
import JenkinsSource from './jenkins';

const JobListURL = 'https://papermc.io/ci/view/PaperMC/api/json'

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
    this.request(JobListURL, (err, res) => {
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
      (job, next) => this.scrapeJob(job, next),
      (err, results) => {
        if (err) return callback(err);
        callback(null, this.combineJobResults(results));
      }
    );
  }

  scrapeJob(jobData, callback) {
    this.log(`Scraping PaperMC Jenkins job: ${jobData.name}`);

    let job;
    if (jobData.name === 'Paper') {
      job = new OldPaperJob(this.name, jobData.url, this.options);
    } else {
      const nameMatch = /^\s*Paper-((?:[0-9]+\.?){3})/.exec(jobData.name);
      if (!nameMatch || nameMatch.length < 2) {
        return callback(new Error(`Invalid PaperMC job name: ${jobData.name}`));
      }

      const minecraftVersion = nameMatch[1];
      job = new PaperJob(minecraftVersion, this.name, jobData.url, this.options);
    }

    job.scrape(callback);
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