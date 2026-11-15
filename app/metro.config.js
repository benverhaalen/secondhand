const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The shared logger lives at the repo root (log/), outside this folder.
config.watchFolders = ['../log', '../spec', '../jobs/capture', '../jobs/studio', '../research/list/ben/platforms', '../scripts'].map(p => path.resolve(__dirname, p)); // spec/examples: the edge serves them until each engine lands
// Files in those folders resolve packages from here: log/native.js reads an EXPO_PUBLIC_ variable, which Babel turns into an
// import of expo/virtual/env, and from ../log there was no node_modules to find it in (every web page was blank, 2026-11-15).
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
module.exports = config;
