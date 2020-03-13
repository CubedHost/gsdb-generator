import Model from "./Model";
import Source from "./Source";
import GameVersion from './GameVersion';

class Game extends Model {
  static get tableName() { return 'game'; }

  static get relationMappings() {
    return {
      versions: {
        relation: this.HasManyRelation,
        modelClass: GameVersion,
        join: {
          from: 'game.id',
          to: 'game_version.game_id'
        }
      },/*
      sources: {
        relation: this.HasManyRelation,
        modelClass: Source,
        join: {
          from: 'game.id',
          to: 'source.game_id'
        }
      }*/
    };
  }
}

export default Game;