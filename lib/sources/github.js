import Source from './base';
import octokit from '@octokit/rest';

const RELEASES_PER_PAGE = 100;

export default class GitHubSource extends Source {

  constructor(...params) {
    super(...params);
    this.octokit = octokit();
  }

  async scrapeGH() {
    let { repoOwner, repoName } = this.options;

    try {
      // GitHub API limits us to 100 releases per page, so that is the
      // hardcoded maximum here, as we want to get all releases anyways.
      let lastResult = [];
      let fullResult = [];
      let page = 1;

      do {
        this.log(`Requesting releases page ${page} from GitHub repo ${repoOwner}/${repoName}`);
        // TODO: Add a timeout here
        let result = await this.octokit.repos.listReleases({
          owner: repoOwner,
          repo: repoName,
          per_page: RELEASES_PER_PAGE,
          page: page++
        });
        lastResult = result.data;
        Array.prototype.push.apply(fullResult, lastResult);
        this.log(`Page length: ${lastResult.length}. Total length: ${fullResult.length}.`);
      } while (lastResult.length === RELEASES_PER_PAGE);

      this.log(`Finished retrieving list of releases (total: ${fullResult.length}).`);
      return {result: fullResult};
    } catch (err) {
      this.log('Error while retrieving releases from GitHub API');
      return {err: err};
    }
  }

  async scrape(callback) {
    const github = await this.scrapeGH();
    if (github.err) {
      return callback(github.err);
    }

    try {
      return callback(null, this.process(github.result));
    } catch (err) {
      console.log('Error while processing');
      return callback(err);
    }
  }
}