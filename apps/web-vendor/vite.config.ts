import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
// Tailwind CSS v4 is handled entirely by @tailwindcss/vite plugin — no postcss.config.* needed
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5175,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
