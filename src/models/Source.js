import Model from "./Model";
import Game from "./Game";
import Package from "./Package";
import SourceConfig from "./SourceConfig";

class Source extends Model {
  static get tableName() { return 'source'; }

  static get relationMappings() {
    return {
      game: {
        relation: this.HasOneRelation,
        modelClass: Game,
        join: {
          from: 'source.game_id',
          to: 'game.id'
        }
      },
      packages: {
        relation: this.HasManyRelation,
        modelClass: Package,
        join: {
          from: 'source.id',
          to: 'package.source_id'
        }
      },
      config: {
        relation: this.HasManyRelation,
        modelClass: SourceConfig,
        join: {
          from: 'source.id',
          to: 'source_config.source_id'
        }
      }
    }
  }
}

export default Source;