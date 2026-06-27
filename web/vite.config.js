import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During `vite dev` we proxy /api to the gateway so the dev server is same-origin too.
// In production the SPA is built to static files and the edge nginx proxies /api.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
