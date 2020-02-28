import async from 'async';
import Source from './base';
import JenkinsSource from './jenkins';

const JobListURL = 'https://papermc.io/ci/'

export default class PaperSource extends Source {
  jobs = [];

  async fetch() {
    const jobs = await ::this.fetchJobList();
    await ::this.scrapeJobs(jobs);
  }

  async fetchJobList() {
    try {
      const res = await this.request(`${JobListURL}/api/json`);
      if (!res || !res.jobs) {
        return new Error(`Got invalid response from PaperMC Jenkins: ${res}`);
      }

      return res.jobs;
    } catch (err) {
      return err;
    }
  }

  async scrapeJobs(jobs) {
    return await async.map(
      jobs,
      (job, next) => this.scrapeJob(job.name, next),
      (err, results) => {
        if (err) return callback(err);
        return this.combineJobResults(results);
      }
    );
  }

  async fetchJob(id) {
    return await this.request(`${JobListURL}/job/${id}/api/json`);
  }

  async scrapeJob(jobName) {
    try {
      const jobData = await this.fetchJob(jobName);
      const jobFullName = jobData.fullDisplayName;
      const newOptions = Object.assign({}, this.options, { url: jobData.url });
      this.log(`Scraping job: ${jobFullName}`);

      let job;

      if (jobName === 'Paper') {
        // Pre-1.13 job ID with builds for older MC versions
        job = new OldPaperJob(this.name, newOptions);
      } else {
        // New Paper builds for 1.13+
        const nameMatch = /^\s*Paper-((?:[0-9]+\.?){2,})$/.exec(jobFullName);
        if (!nameMatch || nameMatch.length < 2) {
          this.log(`Invalid job name: ${jobFullName}`);
          return [];
        }

        const minecraftVersion = nameMatch[1];
        job = new PaperJob(minecraftVersion, this.name, newOptions);
      }

      const results = await job.scrape();
    } catch (err) {
      this.log(`Failed to fetch job: ${jobName}`);
      this.log(err);
      return [];
    }
  }

  async combineJobResults(results) {
    return results
      .filter(_ => _)
      .reduce((a, b) => a.concat(b));
  }

  async process(data) {
    return {
      packages: data,
      meta: {}
    };
  }

}

class OldPaperJob extends JenkinsSource {

  constructor(...params) {
    super(...params);

    this.pomRegex = /^paper(spigot)?.*\.pom$/;
  }

  get module() {
    if (this.build < 444) return 'org.github.paperspigot$paperspigot';
    return 'com.destroystokyo.paper$paper';
  }

  get artifactId() {
    return 'paper';
  }

  async mapMinecraftVersion(build, id) {
    if (build.number >= 1516) {
      build.minecraftVersion = '1.12.2';
      this.packages['1.12.2'].push(build);
      return;
    }

    return super.mapMinecraftVersion(build);
  }

  async process(data) {
    return super.process(data).packages;
  }

}

class PaperJob extends JenkinsSource {

  constructor(minecraftVersion, ...params) {
    super(...params);

    this.minecraftVersion = minecraftVersion;
  }

  mapMinecraftVersions() {
    const builds = Object
      .values(this.builds)
      .map(build => {
        build.minecraftVersion = this.minecraftVersion;
        return build;
      });

    this.packages = {
      [`${this.minecraftVersion}`]: builds
    };
  }

  process(data) {
    return super.process(data).packages;
  }

}
