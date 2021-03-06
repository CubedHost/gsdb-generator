# GSDB Generator
Builds a database of Minecraft server software from various customizable sources, including Mojang, ATLauncher, FTB, and Technic. The data generated by this tool can be ingested by other tools and applications in order to tailor a Minecraft server to your exact needs, display relevant information about the packages offered through these sources, and much more.

## Supported Sources
- Mojang (releases & snapshots)
- ATLauncher
- FTB
- Technic (official modpacks)
- Forge
- Spigot
- Bukkit (via Spigot Hub)
- Paper
- Curse
- BungeeCord

#### Planned
- Sponge (Vanilla & Forge)

_Open an issue if you want to see others added._

## Dependencies
- Node.js
- MongoDB

## Setup
#### Get the source
```bash
$ git clone git@github.com:CubedHost/gsdb-generator.git
$ cd gsdb-generator
$ npm install
```

#### Setup your environment
First, edit `sources.json` to match your needs, then run the following, replacing the MongoDB URI with your own. This will remove existing sources and import the data from sources.json into MongoDB.
```bash
$ ./bin/importSources mongodb://127.0.0.1:21707/gsdb sources.json
```

## CLI Usage
```bash
# The following command will scrape all sources, insert/update data in MongoDB,
# then prune old packages. This is designed to be run on a cron or schedule and
# usually finishes within 10 seconds.
$ ./bin/run
```

## Library Usage
_Coming soon_
