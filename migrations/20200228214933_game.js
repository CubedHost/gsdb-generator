
exports.up = function(knex) {
  return knex.schema.createTable('game', table => {
    table.increments('id');
    table.string('name');
    table.string('slug');
    table.boolean('active').defaultsTo(true);
    table.timestamps();

    table.index('name');
    table.unique('slug');
    table.index('active');
  })
};

exports.down = function(knex) {
  return knex.schema.dropTable('game');
};
