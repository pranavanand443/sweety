import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: { strictPort: true, proxy: { '/api': 'http://127.0.0.1:4310' } },
  build: { outDir: '../dist', emptyOutDir: true },
});
