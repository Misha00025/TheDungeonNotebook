# The Dungeon Notebook — Frontend (монорепо)

SPA-фронтенд для The Dungeon Notebook (управление настольными ролевыми играми: группы, персонажи, предметы, навыки, заметки, квесты).

## Структура монорепо

```
tdn-frontend/
├── package.json                 # npm workspaces: ["apps/*", "packages/*"]
├── tsconfig.base.json           # общие compilerOptions
├── packages/
│   └── shared/                  # @tdn/shared — общий код (auth, theme, ui, utils, config)
├── apps/
│   ├── campaign/                # @tdn/campaign — группы, персонажи, игра
│   └── game-systems/            # @tdn/game-systems — системы, контент, версии, правила
└── README.md
```

- **npm workspaces** — единый `node_modules` в корне, общие зависимости.
- **`@tdn/shared`** подключается через алиас `@tdn/shared` в `vite.config.ts` на исходники `packages/shared/src` (без отдельной сборки пакета; HMR работает).
- **`tsconfig.base.json`** — общие настройки; каждый app/package расширяет его через `extends`.

## Стек

- **React 19** + **TypeScript** (strict)
- **Vite 5** (`@vitejs/plugin-react`) — сборка и dev-сервер
- **react-router-dom 7** (BrowserRouter, вложенные маршруты)
- **react-markdown 10** + **@uiw/react-md-editor 4** — рендер/редактирование markdown
- **CSS Modules** (`.module.css`) + глобальные стили
- Тесты: **Vitest + React Testing Library**

## Доступные скрипты (корень)

```bash
npm install        # установка зависимостей (все workspaces)
npm start          # dev-сервер (Vite), http://localhost:3000, hot reload
npm run build      # tsc + продакшен-сборка в build/
npm run preview    # предпросмотр продакшен-сборки
npm test           # Vitest (watch)
npm run test:run   # Vitest (single run)
```

Скрипты конкретного приложения запускаются из его каталога (`cd apps/campaign && npm run dev`) или через `npm run <script> --workspace @tdn/campaign`.

## Конфигурация API

- Базовый URL API читается из `/config.json` (файл `src/config/index.ts` → `getApiBase()`).
- `loadConfig()` вызывается до рендера; при ошибке фолбэк `http://localhost:5000`.
- В dev-режиме `config.json` отсутствует → используется фолбэк. В Docker `docker-entrypoint.sh` генерирует `config.json` из env `API_BASE`.

## Docker

Каждое приложение — **отдельный Docker-образ** и отдельный контейнер. Сборка идёт из **корня монорепо** (context: `.`), т.к. приложения зависят от `packages/shared`.

### Образы

| Приложение | Образ | Dockerfile |
|---|---|---|
| Кампания | `tdn-campaign` | `apps/campaign/Dockerfile` |
| Игровые системы | `tdn-game-systems` | `apps/game-systems/Dockerfile` |

Multi-stage: builder (`node:20`, `npm ci`, `npm run build --workspace <app>`) → runtime (`node:lts-alpine`, `serve -s build -l 3000`). ENTRYPOINT `docker-entrypoint.sh`, CMD `serve`.

### Базовый путь (VITE_BASE)

По умолчанию `'/'` — приложение деплоится на **отдельный поддомен**. Для деплоя **под путём** (например `/campaign`, `/game-systems`) передайте build-arg `VITE_BASE`:

```bash
docker build -f apps/campaign/Dockerfile --build-arg VITE_BASE=/campaign -t tdn-campaign .
```

`VITE_BASE` попадает в `base` Vite-конфига (см. `vite.config.ts` каждого приложения). Пути/поддомены **не хардкодятся** — конфигурацию сервера решает DevOps/пользователь.

### docker-compose

**Оба приложения сразу** (из корня монорепо):

```bash
cp apps/campaign/template.env .env.campaign
cp apps/game-systems/template.env .env.game-systems
docker compose up -d --build
```

- `campaign` → `tdn-campaign`, порт `3000:3000`
- `game-systems` → `tdn-game-systems`, порт `3001:3000`
- Порт и `VITE_BASE` настраиваются через переменные `CAMPAIGN_PORT` / `GAME_SYSTEMS_PORT` / `VITE_BASE_CAMPAIGN` / `VITE_BASE_GAME_SYSTEMS`.

**Одно приложение отдельно** (compose-файл в каталоге приложения, context `../..`):

```bash
cd apps/campaign && cp template.env .env && docker compose up -d --build
cd apps/game-systems && cp template.env .env && docker compose up -d --build
```

### config.json / API_BASE

- `docker-entrypoint.sh` генерирует `/app/build/config.json` из env `API_BASE` (по умолчанию `http://localhost:5000`), если файла ещё нет.
- Чтобы подложить свой `config.json` (заменит ENV): volume `./config.json:/app/build/config.json:ro`.
- `template.env` в каждом приложении: `API_BASE=...` (+ закомментированный `VITE_BASE`).

> Примечание: доменный код (группы, персонажи, игра) перенесён в `apps/campaign` (подзадача 3.3). Корневой монолит `src/` удалён; корневые `Dockerfile`/`docker-compose.yaml`/`index.html`/`vite.config.ts` переехали в `apps/campaign`. Сборка/тесты запускаются из `apps/campaign` (или через корневые npm-скрипты, делегирующие в `@tdn/campaign`).
