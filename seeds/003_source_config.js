
exports.seed = async function(knex) {
  const sources = await knex('source').select();
  // Deletes ALL existing entries
  return knex('source_config').del()
    .then(async function () {
      // Inserts seed entries
      for (const source of sources) {
        const config = [];

        if (source.name === 'Minecraft: Java Edition') {
          config.push({ key: 'ignoredPackages', value: JSON.stringify([ "old_alpha", "old_beta" ]) });
          config.push({ key: 'ignoredVersions', value: JSON.stringify({
            "release": [
              "1.0", "1.1", "1.2.1", "1.2.2", "1.2.3", "1.2.4"
            ]
          }) });
        }

        if (source.name === 'SpongeVanilla') {
          config.push({ key: 'versionRegex', value: '(?<mcVer>[0-9\.]+)\-(?<spongeVer>.+)' });
        }

        if (source.name === 'SpongeForge') {
          config.push({ key: 'versionRegex', value: '(?<mcVer>[0-9\.]+)\-(?<forgeBuild>[0-9]+)\-(?<spongeVer>.+)' });
        }

        await knex('source_config').insert(config.map(o => { return { source_id: source.id, ...o } }));
      }
    });
};
