import SpigotSource from './spigot';

class CraftBukkitSource extends SpigotSource {

  formatVersionName(info) {
    let buildNumber = info.id;

    let { commits } = info;
    let cbCommit = commits.craftbukkit;

    return `#${buildNumber} (git-${this.name}-${cbCommit})`;
  }

}

export default CraftBukkitSource;
