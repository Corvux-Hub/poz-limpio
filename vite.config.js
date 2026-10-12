import { defineConfig } from 'vite';

// base relativa para que el build funcione en una subruta (GitHub Pages) o en la raíz (Cloudflare Pages).
export default defineConfig({
  base: './',
  build: {
    // Three.js por sí solo ronda los 550 kB minificado.
    chunkSizeWarningLimit: 700,
  },
});
