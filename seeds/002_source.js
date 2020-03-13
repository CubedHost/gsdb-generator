
exports.seed = function(knex) {
  return knex('source').del()
    .then(function () {
      return knex('source').insert([
        // Official Minecraft servers
        { game_id: 1, slug: 'minecraft', platform: 'MinecraftJava', name: 'Minecraft: Java Edition', package_type: 'jar', url: 'https://launchermeta.mojang.com/mc/game/version_manifest.json' },
        { game_id: 2, slug: 'bedrock', platform: 'MinecraftBedrock', name: 'Minecraft: Bedrock Edition', package_type: 'zip', url: 'https://www.minecraft.net/en-us/download/server/bedrock/' },

        // Third-Party Minecraft: Java Edition servers
        { game_id: 1, slug: 'craftbukkit', platform: 'Spigot', name: 'CraftBukkit', package_type: 'jar', url: 'https://hub.spigotmc.org/versions' },
        { game_id: 1, slug: 'spigot', platform: 'Spigot', name: 'Spigot', package_type: 'jar', url: 'https://hub.spigotmc.org/versions' },
        { game_id: 1, slug: 'paper', platform: 'Paper', name: 'Paper', package_type: 'jar', url: 'https://papermc.io/ci' },
        { game_id: 1, slug: 'forge', platform: 'Forge', name: 'Forge', package_type: 'zip', url: 'http://files.minecraftforge.net/maven/net/minecraftforge/forge' },
        { game_id: 1, slug: 'curse', platform: 'Curse', name: 'Curse/Twitch', package_type: 'zip', url: 'https://addons-ecs.forgesvc.net/api/v2/' },
        { game_id: 1, slug: 'technic', platform: 'Technic', name: 'Technic', package_type: 'zip', url: 'https://solder.technicpack.net/api/modpack/' },
        { game_id: 1, slug: 'bungeecord', platform: 'BungeeCord', name: 'BungeeCord', package_type: 'jar', url: 'https://ci.md-5.net/job/BungeeCord' },
        { game_id: 1, slug: 'spongevanilla', platform: 'Sponge', name: 'SpongeVanilla', package_type: 'zip', url: 'https://dl-api.spongepowered.org/v1/org.spongepowered/spongevanilla' },
        { game_id: 1, slug: 'spongeforge', platform: 'Sponge', name: 'SpongeForge', package_type: 'zip', url: 'https://dl-api.spongepowered.org/v1/org.spongepowered/spongeforge' },
        { game_id: 1, slug: 'atlauncher', platform: 'ATLauncher', name: 'ATLauncher', package_type: 'zip', url: 'https://api.atlauncher.com/v1/packs/full/public' },

        // Third-Party Minecraft: Bedrock Edition servers
        { game_id: 2, slug: 'pocketmine', platform: 'PocketMine', name: 'PocketMine', package_type: 'phar', url: 'https://jenkins.pmmp.io/job/PocketMine-MP' },

        // Disabled until further notice.
        //{ game_id: 1, slug: 'tuinity', platform: 'Tuinity', name: 'Tuinity', url: 'https://github.com/Spottedleaf/Tuinity' },
        //{ game_id: 1, slug: 'ftb', platform: 'FeedTheBeast', name:'FeedTheBeast', url: 'https://dist.creeper.host/FTB2' },
        //{ game_id: 2, slug: 'nukkitx', platform: 'NukkitX', name: 'NukkitX', url: 'https://ci.nukkitx.com/job/NukkitX/job/Nukkit' }
      ]);
    });
};