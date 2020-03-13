import Model from "./Model";

class PackageMetadata extends Model {
  static get tableName() { return 'package_metadata'; }
}

export default PackageMetadata;