import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Base defaults to relative path so it works on https://<user>.github.io/<repo>/
  base: './',
  build: {
    outDir: 'dist',
  }
});