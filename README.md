# GSDB Generator
Builds a database of Minecraft server software from various customizable sources, including Mojang, ATLauncher, FTB, and Technic. The data generated by this tool can be ingested by other tools and applications in order to tailor a Minecraft server to your exact needs, display relevant information about the packages offered through these sources, and much more.

## Dependencies
- Node.js/io.js
- MongoDB

This project takes advantage of ES2015 syntax and uses Babel to transpile the source at runtime. If you're using a runetime that supports this syntax natively, you can use `export NO_BABEL_HOOK=1` to prevent it from utilizing Babel.

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
$ ./bin/importSources mongodb://127.0.0.1:37071/gsdb sources.json
```

## CLI Usage
The following command will scrape all sources, insert/update data in MongoDB, then "prune" old packages. This is designed to be run on a cron or schedule and usually finishes within 10 seconds.
```bash
$ ./bin/run
```

## Library Usage
_Coming soon_
