const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro picks up changes in packages/*
config.watchFolders = [monorepoRoot];

// Resolve node_modules from both the app and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Map @grovio/contracts directly to its TypeScript source.
// This avoids a build step during development; plan 01-10 verifies the release build path.
config.resolver.extraNodeModules = {
  '@grovio/contracts': path.resolve(monorepoRoot, 'packages/contracts/src'),
};

module.exports = config;
