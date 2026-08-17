import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Vite configuration (D-009).
 *
 * - React plugin + `@/` path alias → `src/`.
 * - Dev proxy: `/api` and `/uploads` and `/socket.io` are forwarded to the
 *   real backend (Express on :3000) so the SPA and API share one origin in
 *   development (D-006: same-origin via Nginx in production).
 * - `VITE_API_URL` (optional) overrides the base URL for the API client
 *   (see src/lib/api.ts) — leave unset to use the dev proxy.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
