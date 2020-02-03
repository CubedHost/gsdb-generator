import JenkinsSource from './jenkins';

export default class BungeeCordSource extends JenkinsSource {
  pomRegex = /^bungeecord-parent.*\.pom$/;
  artifactRegex = /^BungeeCord\.jar$/;

  getModule(build) {
    return 'net.md-5$bungeecord-parent';
  }

  getMinecraftVersionFromPom(pom) {
    let project = pom.project;
    if (!project) return null;

    let version = project.version;
    if (!version) return null;

    return version[0].replace(/-SNAPSHOT.*/, '');
  }

}
