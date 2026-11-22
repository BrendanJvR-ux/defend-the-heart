import { defineConfig } from 'vite';

// Relative base so the build works both locally and on GitHub Pages (/defend-the-heart/).
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: {
    rollupOptions: {
      input: { main: 'index.html' },
    },
  },
  test: { environment: 'node' },
} as never);
