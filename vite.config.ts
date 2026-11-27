import { defineConfig } from 'vite';

// Relative base so the build works both locally and on GitHub Pages (/defend-the-heart/).
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: {
    // the 3D prototype's page carries Three.js (about 500 kB, 130 kB compressed); the 2D game never loads it
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: { main: 'index.html', play3d: 'play3d.html' },
    },
  },
  test: { environment: 'node' },
} as never);
