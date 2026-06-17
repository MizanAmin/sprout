const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro sees package changes
config.watchFolders = [monorepoRoot];

// Resolve packages from the monorepo node_modules first, then the app's
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Resolve @sprout/db subpath "exports" (e.g. @sprout/db/native) ourselves.
// Enabling Metro's global package-exports breaks react-native's own resolution
// on SDK 52, so we only special-case the workspace package's exports map.
const dbDir = path.resolve(monorepoRoot, 'packages/db');
const dbExports = require(path.join(dbDir, 'package.json')).exports;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@sprout/db/')) {
    const sub = '.' + moduleName.slice('@sprout/db'.length); // e.g. './native'
    const rel = dbExports[sub];
    if (rel) return { type: 'sourceFile', filePath: path.resolve(dbDir, rel) };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
