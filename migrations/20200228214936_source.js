
exports.up = function(knex) {
  return knex.schema.createTable('source', table => {
    table.increments('id');
    table.integer('game_id').unsigned().references('game.id');
    table.string('platform');
    table.string('slug');
    table.string('name');
    table.string('url');
    table.enum('package_type', ['jar', 'phar', 'zip', 'tar', 'tgz']);
    table.boolean('active').defaultsTo(true);
    table.timestamps();
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('source');
};
