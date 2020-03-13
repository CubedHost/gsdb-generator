import Model from "./Model";
import PackageVersion from "./PackageVersion";
import PackageMetadata from "./PackageMetadata";

class Package extends Model {
  static get tableName() { return 'package'; }

  // @TODO: Add Queued as mapping or something of that nature. Does not need its own model.
  static get relationMappings() {
    return {
      versions: {
        relation: this.HasManyRelation,
        modelClass: PackageVersion,
        join: {
          from: 'package.id',
          to: 'package_version.package_id'
        }
      },
      metadata: {
        relation: this.HasManyRelation,
        modelClass: PackageMetadata,
        join: {
          from: 'package.id',
          to: 'package_metadata.package_id'
        }
      }
    }
  }
}

export default Package;