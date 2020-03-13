import Model from "./Model";

class Cache extends Model {
  static get idColumn() { return 'key'; }
  static get tableName() { return 'cache'; }

  static get relationMappings() {
    return {
    };
  }
}

export default Cache;