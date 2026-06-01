'use strict';
const { createEslintConfig } = require('@grovio/config/eslint-preset');
module.exports = createEslintConfig({ react: true, viteRefresh: true });
