
exports.up = function(knex) {
  return knex.schema.createTable('source_config', table => {
    table.increments('id');
    table.integer('source_id').unsigned().references('source.id');
    table.string('key');
    table.text('value');
    table.timestamps();
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('source_config');
};
