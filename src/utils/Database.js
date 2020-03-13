import knex from 'knex';
import Objection from 'objection';

class Database {

  static init() {
    this.client = knex({
      client: global.config.database.source,
      connection: global.config.database.config,
      pool: global.config.database.pool
    });

    Objection.Model.knex(Database.client);
  }

  static close() {
    return this.client.destroy();
  }
}

export default Database;