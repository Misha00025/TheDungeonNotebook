/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import { fileURLToPath, URL } from 'node:url';

// Кампания — remote-приложение микрофронтендов.
//
// Собирается и деплоится отдельно. Хаб (host) подключает его через Module
// Federation: экспонируем доменные модули, которые монтирует хаб:
//   - App  — всё приложение (хаб монтирует под /campaign/*)
//   - Home — только страница «Главная» (хаб подгружает на общей вкладке «Главная»)
//
// Общие зависимости (react, react-dom, react-router-dom) — синглтоны с
// совпадающими версиями у всех приложений (см. shared в vite.config хаба).
export default defineConfig({
  // Базовый путь приложения. По умолчанию '/' (отдельный поддомен).
  // Для деплоя под путём (например /campaign) задайте VITE_BASE (build-arg / env).
  base: process.env.VITE_BASE || '/',
  // Публичные ассеты (favicon, logo, manifest, robots) — общие для всего
  // проекта, лежат в корневом public/ монорепо.
  publicDir: '../../public',
  plugins: [
    react(),
    federation({
      name: 'campaign',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.tsx',
        './Home': './src/Home.tsx',
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
    // Module Federation генерирует remoteEntry.js с top-level await
    // (importShared). Целевой формат должен поддерживать top-level await.
    target: 'esnext',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    css: false,
  },
});
