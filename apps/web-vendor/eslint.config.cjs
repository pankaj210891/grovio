'use strict';
const { createEslintConfig } = require('@grovio/config/eslint-preset');
module.exports = createEslintConfig(
  { react: true, viteRefresh: true },
  [
    // Ignore TypeScript compilation artifacts emitted in-place by tsc -b.
    // Vite reads .tsx/.ts directly; these .d.ts/.js files are build artifacts, not source.
    {
      ignores: [
        'src/**/*.d.ts',
        'src/**/*.d.ts.map',
        'src/**/*.js',
        'src/**/*.js.map',
      ],
    },
  ],
);
