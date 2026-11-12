/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import { fileURLToPath, URL } from 'node:url';

// Хаб (shell) — host-приложение микрофронтендов.
// Точка входа, общая левая панель, оркестрация сессии, монтирование remotes.
//
// Remotes (campaign, game-systems, profile, login) ещё не готовы — их URL
// декларируются как переменные окружения (VITE_REMOTE_*) с фолбэком-заглушкой.
// Когда remote будет развёрнут, достаточно задать URL его remoteEntry.js.
const remoteUrl = (env: string, fallback: string): string =>
  process.env[env] || fallback;

export default defineConfig({
  // Базовый путь приложения. По умолчанию '/' (отдельный поддомен).
  // Для деплоя под путём (например /hub) задайте VITE_BASE (build-arg / env).
  base: process.env.VITE_BASE || '/',
  // Публичные ассеты (favicon, logo, manifest, robots) — общие для всего
  // проекта, лежат в корневом public/ монорепо.
  publicDir: '../../public',
  plugins: [
    react(),
    federation({
      name: 'hub',
      filename: 'remoteEntry.js',
      // Хаб — host: сам ничего не экспонирует, но объявляет remotes.
      remotes: {
        campaign: remoteUrl('VITE_REMOTE_CAMPAIGN', 'http://localhost:3000/assets/remoteEntry.js'),
        profile: remoteUrl('VITE_REMOTE_PROFILE', 'http://localhost:3002/assets/remoteEntry.js'),
        login: remoteUrl('VITE_REMOTE_LOGIN', 'http://localhost:3003/assets/remoteEntry.js'),
      },
      // Общие зависимости — синглтоны с совпадающими версиями у всех приложений.
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  resolve: {
    alias: {
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
});
