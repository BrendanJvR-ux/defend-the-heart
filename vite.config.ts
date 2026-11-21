import { defineConfig } from 'vite';

// Relative base so the build works both locally and on GitHub Pages (/the-last-ward/).
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  test: { environment: 'node' },
} as never);
