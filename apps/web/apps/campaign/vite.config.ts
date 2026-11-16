import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import { fileURLToPath, URL } from 'node:url';
import { remoteAssetConfig } from '../../remote-build.config';

export default defineConfig({
  ...remoteAssetConfig,
  publicDir: false,
  plugins: [
    react(),
    federation({
      name: 'campaign',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx',
        './Home': './src/Home.tsx',
        './CompleteProfile': './src/CompleteProfile.tsx',
      },
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tdn/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      input: fileURLToPath(new URL('./src/remote.ts', import.meta.url)),
    },
    target: 'esnext',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    css: false,
  },
});
