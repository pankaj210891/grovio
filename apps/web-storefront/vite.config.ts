import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
// Tailwind CSS v4 is handled entirely by @tailwindcss/vite plugin — no postcss.config.* needed
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@': '/src',
      // motion/react is the canonical import path for framer-motion v12 (CLAUDE.md).
      // The 'motion' npm package is the future home; currently framer-motion v12
      // re-exports the same API from the 'motion/react' sub-path.
      // This alias satisfies both TypeScript (motion-react.d.ts shim) and Vite/Rolldown
      // so the build resolves correctly at bundle time.
      'motion/react': 'framer-motion',
    },
  },
});
