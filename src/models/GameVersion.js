import Model from "./Model";
import Game from "./Game";
import Package from "./Package";

class GameVersion extends Model {
  static get tableName() { return 'game_version'; }

  static get relationMappings() {
    return {
    }
  }
}

export default GameVersion;