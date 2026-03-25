import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: 'dist', assetsInlineLimit: 8192 },
  server: { port: 3002, host: true },
});
