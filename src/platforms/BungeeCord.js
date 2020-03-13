import JenkinsPomPlatform from './JenkinsPom';

export default class BungeeCordPlatform extends JenkinsPomPlatform {
  pomRegex = /^bungeecord-parent.*\.pom$/;
  artifactRegex = /^BungeeCord\.jar$/;

  get artifactId() {
    return 'bungeecord-bootstrap';
  }
}