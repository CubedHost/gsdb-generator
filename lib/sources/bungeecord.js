import JenkinsSource from './jenkins';

export default class BungeeCordSource extends JenkinsSource {
  pomRegex = /^bungeecord-parent.*\.pom$/;
  artifactRegex = /^BungeeCord\.jar$/;

  constructor(name, options) {
    super(name, options);
    this.url = options.url;
  }

  get artifactId() {
    return 'bungeecord-bootstrap';
  }
}
