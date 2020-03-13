import Platform from './Platform';
import { Octokit } from '@octokit/rest';

const RELEASES_PER_PAGE = 100;

// @TODO: Better GitHub user/repo name regex. Just need it to work for now.
const GITHUB_URL_REGEX = /github\.com\/(?<repoOwner>[^\/]+)\/(?<repoName>[^\/]+)$/;

export default class GitHubPlatform extends Platform {
  github = {
    packages: []
  };
  octokit = new Octokit({
    request: {
      timeout: 10000
    }
  });

  constructor(...params) {
    super(...params);
    
    const originMatch = this.options.url.match(GITHUB_URL_REGEX);
    let configOpts;

    if (originMatch && originMatch.groups) {
      this.log(`Automatically set repository configuration from origin URL.`);
      [ 'repoOwner', 'repoName' ].forEach(k => this.options.config.push({
        key: k, value: originMatch.groups[k]
      }));
    }
    
    if (configOpts = this.options.config.filter(c => ['repoName', 'repoOwner'].includes(c.key))) {
      this.repoName = configOpts.find(co => co.key === 'repoName').value;
      this.repoOwner = configOpts.find(co => co.key === 'repoOwner').value;
    } else {
      throw new Error(`Misconfigured: Add a repoName and repoOwner configuration value for the ${this.options.name} source (${this.constructor.name}) or set the origin URL to the link of the GitHub repo.`);
    }
  }

  async fetchRemote() {
    return ::this.getReleases();
  }

  async getReleases(lastVer = undefined) {
    try {
      const options = this.octokit.repos.listReleases.endpoint.merge({
        owner: this.repoOwner,
        repo: this.repoName
      });

      for await (const response of this.octokit.paginate.iterator(options)) {
        for (const release of response.data) {
          this.github.packages.push(release);
        }
      }
    } catch (err) {
      this.log('Error while retrieving releases from GitHub API', err.message);
      throw err;
    }
  }
}
