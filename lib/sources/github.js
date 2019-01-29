import Source from './base';
import Octokit from '@octokit/rest';

const RELEASES_PER_PAGE = 100;

export default class GitHubSource extends Source {

  constructor(...params) {
    super(...params);
    this.octokit = new Octokit({
      request: {
        timeout: 10000
      }
    });
  }

  fetchRemote(callback) {
    this.gh = {
      page: 1,
      packages: [],
      callback: callback
    };

    this.getReleases();
  }

  getReleases() {
    const { repoOwner, repoName } = this.options;
    this.log(`Requesting releases page ${this.gh.page} from GitHub repo ${repoOwner}/${repoName}`);
    this.octokit.repos.listReleases({
      owner: repoOwner,
      repo: repoName,
      per_page: RELEASES_PER_PAGE,
      page: this.gh.page++
    }).then(::this.releasesCallback).catch(::this.onGitHubError);
  }

  releasesCallback(data) {
    Array.prototype.push.apply(this.gh.packages, data.data);
    this.log(`Page length: ${data.data.length}. Total length: ${this.gh.packages.length}.`);
    if (data.data.length === RELEASES_PER_PAGE) {
      setImmediate(this.getReleases);
    } else {
      this.log(`Finished retrieving list of releases (total: ${this.gh.packages.length}).`);
      this.gh.callback(null, this.gh.packages);
    }
  }

  onGitHubError(err) {
    this.log('Error while retrieving releases from GitHub API');
    return this.gh.callback(err);
  }
}
