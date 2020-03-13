
exports.up = function(knex) {
  return knex.schema.createTable('package_version_build_queue', table => {
    table.integer('package_version_id').unsigned().references('package_version.id');
    table.timestamps();
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('package_version_build_queue');
};
