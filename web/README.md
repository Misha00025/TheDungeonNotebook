# TDN Web workspace

Web — frontend workspace платформы The Dungeon Notebook. Это Vite-приложения на React 19 и TypeScript, управляемые npm workspaces.

## Структура

- `apps/hub` — оболочка и навигация приложений.
- `apps/campaign` — интерфейс кампаний.
- `apps/login` — вход.
- `apps/profile` — профиль.
- `apps/game-systems` — интерфейс игровых систем; отключён в конфигурации default Compose, активная Compose-конфигурация для него не заявляется.
- `packages/shared` — общие frontend-модули.

## Установка и скрипты

Из корня репозитория:

```bash
cp web/template.env web/.env
npm ci --prefix web
make check-web
```

Из каталога `web/` доступны `npm run typecheck --workspaces --if-present`, `npm run test:run` и `npm run build --workspaces --if-present`. Корневой `npm run build` собирает только hub; для сборки workspaces с соответствующим скриптом используется `npm run build --workspaces --if-present`. Typecheck workspaces вызывается аналогично. `make web-test` — alias для web tests.

## Docker Compose

Рабочий каталог и Docker build context Compose — `web/`, не корень всего репозитория. Скопируйте runtime-конфигурацию из `template.env` в `web/.env`. Compose читает build-переменные из `template.env.build` (или переопределённого файла, например `.env.build`) посредством `--env-file`.

Из корня репозитория:

```bash
cp web/template.env web/.env
make build-web
make run-web
# Альтернативный build env:
make build-web WEB_BUILD_ENV=.env.build
```

`make run-web` запускает текущую Compose-конфигурацию из `web/`; не объединяйте её с backend Compose, у которого отдельный контекст и окружение.

Текущие порты: campaign — 3000, profile — 3002, login — 3003, hub — 3004. Game-systems не включён в default Compose. Эти сведения описывают конфигурацию Compose, а не утверждают, что полный стек автоматически обеспечивает все сервисы платформы.
