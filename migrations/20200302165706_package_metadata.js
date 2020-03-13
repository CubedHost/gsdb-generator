
exports.up = function(knex) {
  return knex.schema.createTable('package_metadata', table => {
    table.increments('id');
    table.integer('package_id').unsigned().references('package.id');
    table.string('key');
    table.string('value');
    table.timestamps();

    table.index(['package_id', 'key']);
    table.index('key');
    table.index('value');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('package_metadata');
};
