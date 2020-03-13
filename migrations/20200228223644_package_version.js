
exports.up = function(knex) {
  return knex.schema.createTable('package_version', table => {
    table.increments('id');
    table.integer('package_id').unsigned().references('package.id');
    table.integer('game_version_id').unsigned().references('game_version.id');
    table.string('name');
    table.string('version');
    table.string('origin');
    table.string('download_url');
    table.boolean('active').defaultsTo(true);
    table.timestamps();

    table.unique([ 'package_id', 'game_version_id', 'version' ]);
    table.index('name');
    table.index('version');
    table.index('origin');
    table.index('active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('package_version');
};
