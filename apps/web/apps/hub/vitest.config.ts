import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tdn/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
      'virtual:__federation__': fileURLToPath(new URL('./src/remote/federation.test-support.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [fileURLToPath(new URL('../../packages/shared/src/setupTests.ts', import.meta.url))],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
