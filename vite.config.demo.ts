import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Demo page build: outputs to doc-public/demo/ for GitHub Pages
// root: 'demo' so Vite treats demo/index.html as the entry — avoids nested demo/demo/ path
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: path.resolve(__dirname, 'demo'),
  build: {
    outDir: path.resolve(__dirname, 'doc-public/demo'),
    emptyOutDir: true,
  },
  base: './',
});
