
exports.up = function(knex) {
  return knex.schema.createTable('cache', table => {
    table.string('key');
    table.text('value');

    table.primary('key');
    table.index('value', 'value', 'fulltext');
    table.timestamps();
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('cache');
};
