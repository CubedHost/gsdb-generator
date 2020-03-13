
exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('game').del()
    .then(function () {
      // Inserts seed entries
      return knex('game').insert([
        { name: 'Minecraft: Java Edition', slug: 'minecraft' },
        { name: 'Minecraft: Bedrock Edition', slug: 'minecraftbedrock' }
      ]);
    });
};
