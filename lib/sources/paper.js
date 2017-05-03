import JenkinsSource from './jenkins';

export default class PaperSource extends JenkinsSource {

  constructor(...params) {
    super(...params);

    this.pomRegex = /^paper(spigot)?.*\.pom$/;
  }

  getModule(build) {
    if (build < 444) return 'org.github.paperspigot$paperspigot';
    return 'com.destroystokyo.paper$paper';
  }

}
