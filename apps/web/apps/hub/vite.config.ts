import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import { fileURLToPath, URL } from 'node:url';

const remoteUrl = (env: string, fallback: string): string =>
  process.env[env] || fallback;

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  publicDir: '../../public',
  plugins: [
    react(),
    federation({
      name: 'hub',
      filename: 'remoteEntry.js',
      remotes: {
        campaign: remoteUrl('VITE_REMOTE_CAMPAIGN', 'http://localhost:3000/assets/remoteEntry.js'),
        profile: remoteUrl('VITE_REMOTE_PROFILE', 'http://localhost:3002/assets/remoteEntry.js'),
        login: remoteUrl('VITE_REMOTE_LOGIN', 'http://localhost:3003/assets/remoteEntry.js'),
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
    port: 3004,
    strictPort: true,
  },
  build: {
    outDir: 'build',
    target: 'esnext',
  },
});
