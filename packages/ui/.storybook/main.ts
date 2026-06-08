import type { StorybookConfig } from '@storybook/react-vite';
import type { Plugin } from 'vite';

// Vite 8 uses Rolldown instead of Rollup. Rolldown cannot resolve subpath
// imports (e.g. @storybook/react/dist/entry-preview.mjs) from virtual
// modules because it has no filesystem anchor for node_modules lookup.
// This plugin intercepts those imports and redirects them to absolute paths
// resolved relative to @storybook/react-vite (which has @storybook/react
// as a direct dependency in the pnpm store).
function storybookRolldownFix(): Plugin {
  return {
    name: 'storybook-rolldown-fix',
    async resolveId(source) {
      if (source === '@storybook/react/dist/entry-preview.mjs' ||
          source === '@storybook/react/dist/entry-preview-docs.mjs') {
        const { createRequire } = await import('module');
        const req = createRequire(
          new URL('../node_modules/@storybook/react-vite/package.json', import.meta.url)
        );
        return req.resolve(source);
      }
      return null;
    },
  };
}

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal(cfg) {
    return {
      ...cfg,
      plugins: [
        ...(cfg.plugins ?? []),
        storybookRolldownFix(),
      ],
    };
  },
};

export default config;
