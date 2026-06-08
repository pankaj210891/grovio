import type { Preview } from '@storybook/react';
import React from 'react';
import '../src/tokens/tokens.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: 'oklch(98% 0.005 250)' },
        { name: 'dark', value: 'oklch(15% 0.02 250)' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const bg = context.globals?.backgrounds?.value ?? '';
      const isDark = bg.includes('15%');
      return (
        <div
          className={isDark ? 'dark' : ''}
          style={{
            padding: '1.5rem',
            minHeight: '100vh',
            background: 'var(--background)',
            color: 'var(--foreground)',
          }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
