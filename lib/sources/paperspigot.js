import SpigotSource from './spigot';

class PaperSpigotSource extends SpigotSource {

  constructor(...params) {
    super(...params);

    this.localDataPath = null;
    this.fork = 'paper';
  }

}

export default PaperSpigotSource;
