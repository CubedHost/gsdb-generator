
exports.up = function(knex) {
  return knex.schema.createTable('game_version', table => {
    table.increments('id');
    table.integer('game_id').unsigned().references('game.id');
    table.string('version');
    table.boolean('active').defaultsTo(true);
    table.timestamps();

    table.unique([ 'game_id', 'version' ]);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('game_version');
};
