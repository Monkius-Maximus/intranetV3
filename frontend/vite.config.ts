import { defineConfig } from 'vite';

// Static SPA built into dist/ and served by nginx in production. The dev proxy
// forwards /api to the backend so `npm run dev` works on the DEV machine.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
});
