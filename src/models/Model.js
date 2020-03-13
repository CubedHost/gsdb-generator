import Database from '../utils/Database';
import Objection from 'objection';

class Model extends Objection.Model {
  static get idColumn() {
    return 'id';
  }

  static get tableName() {
    return 'misconfigured';
  }
}

export default Model;