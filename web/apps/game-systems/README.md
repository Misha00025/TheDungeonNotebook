# @tdn/game-systems

Приложение «Игровые системы» — системы, контент-каталоги, версии, правила (новый код).

> Скелет: подключён `@tdn/shared`, есть auth (Login), тема, layout и пустые маршруты (заглушки WorkInProgress). Наполнение домена — отдельными тикетами.

## Статус: remote-приложение микрофронтендов

Игровые системы — **remote** в архитектуре микрофронтендов (Module Federation,
`@originjs/vite-plugin-federation`). Собирается и деплоится отдельно.

- **Хаб (host)** монтирует приложение под префиксом `/systems/*` (модуль
  `game-systems/App`).
- **Маршрутизация — у приложения** (вложенные роутеры). Хаб знает только
  верхний уровень.
- **Сессия** оркеструет хаб и прокидывает её в remote через пропс `session`.
  При автономном запуске (без хаба) приложение грузит сессию из хранилища
  (fallback) — см. `src/session/SessionProvider.tsx`.
- **Собственной навигации/панели нет** — её передаёт хаб. Внутренняя
  навигация относительна к корню приложения (см. `src/navigation.ts`).
- **Темы** владеет хаб; логика прогрузки тем в remote не заносится.

### Экспонируемые модули (vite.config.ts → federation.exposes)

- `./App` — всё приложение (монтируется хабом под `/systems/*`).

### Автономный запуск

```bash
npm run dev --workspace @tdn/game-systems   # dev-сервер на :3001
```

Не весь функционал работает автономно (сессия грузится из хранилища).

### Сборка

```bash
npm run build --workspace @tdn/game-systems
```

`build.target: 'esnext'` обязателен — remoteEntry.js генерируется с
top-level await.

## Docker

Отдельный образ `tdn-game-systems` (Dockerfile в этом каталоге, сборка из корня монорепо). Базовый путь по умолчанию `'/'`; для деплоя под путём — build-arg `VITE_BASE=/game-systems`. Подробности — в корневом `README.md` (раздел Docker).

## Структура

- `src/main.tsx` — bootstrap (loadConfig) + рендер.
- `src/App.tsx` — провайдеры (Auth → Theme → Session → Router) и маршруты.
- `src/layout/AppLayout.tsx` — общий layout (PageLayout, без собственной панели).
- `src/pages/` — Login, SystemsList, SystemLayout, SystemOverview, WorkInProgress (заглушки разделов).
- `src/navigation.ts` — внутренняя навигация, относительная к корню приложения.
- `src/session/` — контракт и провайдер сессии (fallback из хранилища).
- `public/config.json` — API_BASE (генерится docker-entrypoint.sh из `API_BASE`).
