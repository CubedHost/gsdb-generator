import SpigotSource from './spigot';

class CraftBukkitSource extends SpigotSource {

  constructor(...params) {
    super(...params);
  }

  formatVersionName(info) {
    let buildNumber = info.id;

    let { commits } = info;
    let cbCommit = commits.craftbukkit;

    return `#${buildNumber} (git-${this.name}-${cbCommit})`;
  }

}

export default CraftBukkitSource;
