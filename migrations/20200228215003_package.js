
exports.up = function(knex) {
  return knex.schema.createTable('package', table => {
    table.increments('id');
    table.integer('source_id').unsigned().references('source.id');
    table.string('source_ref');
    table.string('slug');
    table.string('name');
    table.boolean('active').defaultsTo(true);
    table.timestamps();

    table.unique([ 'source_id', 'slug', 'source_ref' ]);
    table.index('name');
    table.index('source_ref');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('package');
};