const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The shared logger lives at the repo root (log/), outside this folder.
config.watchFolders = [path.resolve(__dirname, '../log'), path.resolve(__dirname, '../spec')]; // spec/examples: the edge serves them until each engine lands
module.exports = config;
