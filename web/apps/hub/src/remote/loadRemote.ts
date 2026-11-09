// Механизм подгрузки remote-модулей (Module Federation).
//
// Хаб — host. Remote-модули подгружаются динамическим импортом
// `import('remoteName/Module')`, который vite-plugin-federation транслирует
// в __federation_method_getRemote. Здесь — тонкая обёртка: кэширование
// загруженных модулей и типизированный доступ к контракту RemoteModule.
//
// ВАЖНО: vite-plugin-federation транслирует в __federation_method_getRemote
// ТОЛЬКО динамические импорты со статическим строковым литералом
// (import('campaign/App')). Импорт через шаблонную строку
// (import(`${name}/${module}`)) плагин НЕ распознаёт — remotes-карта и
// __federation_method_getRemote не попадают в бандл. Поэтому здесь —
// статическая карта лоадеров с литеральными импортами.

import type { RemoteModule, RemoteDescriptor } from './types';

// Статические динамические импорты remote-модулей (литеральные строки).
const loaders: Record<string, Record<string, () => Promise<RemoteModule>>> = {
  campaign: {
    App: () => import('campaign/App'),
    Home: () => import('campaign/Home'),
  },
  profile: {
    App: () => import('profile/App'),
  },
  login: {
    App: () => import('login/App'),
  },
};

// Кэш загруженных remote-модулей (по ключу `${name}/${module}`).
const moduleCache = new Map<string, RemoteModule>();

/**
 * Загружает remote-модуль по имени remote и имени модуля.
 * Кэширует результат, чтобы не грузить один модуль дважды.
 */
export async function loadRemoteModule(
  name: RemoteDescriptor['name'],
  module: string
): Promise<RemoteModule> {
  const key = `${name}/${module}`;
  const cached = moduleCache.get(key);
  if (cached) return cached;

  const loader = loaders[name]?.[module];
  if (!loader) {
    throw new Error(`Unknown remote module: ${name}/${module}`);
  }

  const mod = await loader();
  moduleCache.set(key, mod);
  return mod;
}
