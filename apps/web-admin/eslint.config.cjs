'use strict';
const { createEslintConfig } = require('@grovio/config/eslint-preset');
module.exports = createEslintConfig({ react: true, viteRefresh: true }, [
  // Ignore generated TypeScript declaration files in src/ (stale tsc output)
  { ignores: ['src/**/*.d.ts', 'src/**/*.d.ts.map'] },
]);
