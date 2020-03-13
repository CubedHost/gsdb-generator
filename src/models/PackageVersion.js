import Model from "./Model";
import GameVersion from "./GameVersion";

class PackageVersion extends Model {
  static get tableName() { return 'package_version'; }
  
  static relationMappings() {
    return {
      versions: {
        relation: this.BelongsToOneRelation,
        modelClass: GameVersion,
        join: {
          from: 'package_version.game_version_id',
          to: 'game_version.id'
        }
      }
    };
  }
}

export default PackageVersion;