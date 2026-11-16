import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [
    react(),
    federation({
      name: 'login',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx',
      },
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  resolve: {
    alias: {
      '@tdn/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
    },
  },
  server: {
    port: 3003,
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      input: fileURLToPath(new URL('./src/remote.ts', import.meta.url)),
    },
    target: 'esnext',
  },
});
