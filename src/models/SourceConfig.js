import Model from "./Model";
import Game from "./Game";
import Source from "./Source";

class SourceConfig extends Model {
  static get tableName() { return 'source_config'; }

  static get relationMappings() {
    return {
    }
  }
}

export default SourceConfig;