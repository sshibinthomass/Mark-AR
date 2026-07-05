import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  base: isGitHubPages ? '/Mark-AR/' : '/',
  resolve: {
    alias: {
      'node-fetch': fileURLToPath(new URL('./src/vendor/shims/nodeFetch.ts', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
