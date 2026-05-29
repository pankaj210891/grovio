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

// Point to the package root so Metro uses the package.json exports map in both
// dev and release modes. Metro 0.80+ (RN 0.83) resolves exports map entries,
// which directs it to dist/ in release mode and supports package-level imports.
config.resolver.extraNodeModules = {
  '@grovio/contracts': path.resolve(monorepoRoot, 'packages/contracts'),
};

module.exports = config;
