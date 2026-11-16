import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import { fileURLToPath, URL } from 'node:url';
import { createRemoteConfig } from './remote.config';

const { remotes, proxy } = createRemoteConfig(process.env);

export default defineConfig({
  base: './',
  publicDir: '../../public',
  plugins: [
    react(),
    federation({
      name: 'hub',
      filename: 'remoteEntry.js',
      remotes,
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  resolve: {
    alias: {
      '@tdn/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
    },
  },
  server: {
    port: 3004,
    strictPort: true,
    proxy,
  },
  preview: {
    proxy,
  },
  build: {
    outDir: 'build',
    target: 'esnext',
  },
});
