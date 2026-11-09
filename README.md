# The Dungeon Notebook

Лучшая записная книжка любителя подземелий и других приключенческих штук :)

## Карта репозитория

Корень репозитория — основная платформа TDN, а не отдельное приложение `apps/notebook`.

- `backend/` — API Gateway и несколько backend-сервисов; см. их README.
- `web/apps/{hub,campaign,login,profile,game-systems}/` — приложения web workspace.
- `web/packages/shared/` — общие frontend-пакеты.
- `admin/` — административная панель.
- `monitoring/` — конфигурация мониторинга.
- `docs/` — документация, включая [документацию API](docs/api/) и [историю объединения](docs/repository-history.md).

Подробности web-приложений: [web/README.md](web/README.md).

### Сборка Docker-образов

Для сборки образов отдельные runtime `.env` и RSA-сертификаты не нужны: сборочная конфигурация находится в корневом `docker-compose.build.yaml` и только собирает выбранные образы. Runtime `.env` нужен только командам запуска (`make run*`).

В новых сборочных контекстах admin, api-gateway и sync-service `.env`-файлы и ключи исключены через локальные `.dockerignore`; это не распространяется на все контексты репозитория. `IMAGE_TAG` задаёт вручную дополнительный тег для сборки: образ получает и `<repository>:latest`, и `<repository>:<IMAGE_TAG>` из одной сборки (без push). Например, `IMAGE_TAG=1.2.3` обновляет `latest` и создаёт/обновляет `1.2.3`; так происходит при любом пользовательском значении, включая `dev`. Git tags автоматически не создаются. `IMAGE_TAG` не переключает runtime Compose; его настройки и теги можно настраивать отдельно. Теги backend/admin с `latest` совместимы с образами прежних Compose при стандартных project names `backend`/`admin`, но не гарантируют совместимость при произвольном `-p`.

```bash
make build SERVICE=auth-service       # ровно один образ
make build SERVICE=auth-service IMAGE_TAG=1.2.3 # backend-auth-service:latest и :1.2.3
make build IMAGE_TAG=1.2.3             # все 12 образов: для каждого repository latest и 1.2.3
make build                            # все 12 образов
make build-backend                    # шесть backend
make build-web                        # пять web, включая game-systems
make build-admin                      # только admin-panel
make build-web-campaign               # явный target одного образа
make list-images
```

Реестр образов: `api-gateway`, `auth-service`, `users-service`, `campaign-service`, `game-systems-service`, `sync-service`, `admin-panel`, `web-hub`, `web-campaign`, `web-profile`, `web-login`, `web-game-systems`. Скачиваемые образы БД/мониторинга не входят в этот список; `shared` — библиотека, а не образ. `web-game-systems` собирается отдельно или через `build-web`, но не включается в runtime Compose.

Параметры web-сборки по умолчанию берутся из `web/template.env.build`. Переопределить файл можно относительно `web/` или абсолютным путём: `make build-web WEB_BUILD_ENV=.env.build` либо `make build-web WEB_BUILD_ENV=/path/to/build.env`. `IMAGE_TAG` задаёт общий тег (по умолчанию `latest`), `BUILD_FLAGS` передаёт флаги Compose build:

```bash
make build SERVICE=web-hub IMAGE_TAG=ci-42 BUILD_FLAGS="--no-cache --pull"
```

`make help` выводит краткую справку. Runtime Compose и команды запуска остаются отдельными; публикации образов нет.

### Подготовка и команды web

```bash
cp web/template.env web/.env
npm ci --prefix web
make check-web
make build
make run
```

Runtime `.env` нужен для запуска web через `make run-web`. `make build` теперь использует отдельный корневой build compose и не запускает сервисы.

### Backend

API Gateway (порт 5000) — входная точка backend:

- **api-gateway** — [README](backend/api-gateway/README.md)
- **auth-service** — [README](backend/auth-service/README.md)
- **users-service** — [README](backend/users-service/README.md)
- **campaign-service** — [README](backend/campaign-service/README.md)
- **game-systems-service** — [правила сервиса](backend/game-systems-service/rules.md)
- **sync-service** — [README](backend/sync-service/README.md)


### Базы данных

- **MySQL 8.0** — auth-service, users-service, campaign-service, game-systems-service
- **MongoDB** — campaign-service, users-service (settings), game-systems-service (snapshots)
- **Redis** — кэш (auth-service)

## Переменные окружения (.env)

| Переменная | Описание |
|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | Пользователь MongoDB |
| `MONGO_INITDB_ROOT_PASSWORD` | Пароль MongoDB |
| `MYSQL_ROOT_PASSWORD` | Root-пароль MySQL |
| `MYSQL_USER` | Пользователь MySQL |
| `MYSQL_PASSWORD` | Пароль MySQL |
| `AUTH_DATABASE` | Имя БД MySQL для auth-service |
| `USERS_DATABASE` | Имя БД MySQL для users-service |
| `CAMPAIGN_DATABASE` | Имя БД MySQL для campaign-service |
| `GAME_SYSTEMS_DATABASE` | Имя БД MySQL для game-systems-service |
| `REDIS_CONNECTION_STRING` | Строка подключения к Redis |

Также требуются RSA-ключи в `backend/certs/private.pem` и `backend/certs/public.pem`.

## Настройка и запуск (Docker)

```bash
cd backend

# Создать .env на основе шаблона
# Поместить RSA-ключи в ./certs/private.pem и ./certs/public.pem

docker compose up -d
```

После запуска:
- API Gateway доступен на `http://localhost:5000`
- Metrics (Prometheus) доступны на `/metrics` у каждого сервиса

Порядок запуска (docker-compose управляет автоматически через depends_on):
1. MySQL + MongoDB + Redis
2. auth-service, users-service, campaign-service, game-systems-service
3. sync-service
4. api-gateway



## Makefile (автоматизация)

В корне проекта находится `Makefile` для часто используемых операций.

| Команда | Описание |
|---------|----------|
| `make test` | Запуск интеграционных тестов. Выполняет `cd backend/tests && ./test.sh 5` — очищает БД, пересобирает контейнеры, генерирует свежие RSA-ключи, ждёт 5 секунд и прогоняет все сценарии. |
| `make build [SERVICE=<name>]` | Собирает один выбранный образ либо все 12 образов, если SERVICE не задан. |
| `make run` | Запуск backend и web: `make run-backend run-web`; web требует `web/.env`. |
| `make check-web` | Web typecheck, тесты и сборка. |
| `make web-install` | Установка web workspace через `npm ci`. |
| `make web-typecheck` | Typecheck web workspaces, где задан соответствующий script. |
| `make web-test` / `make test-web` | Web tests (`npm run test:run`). |
| `make web-build` | Сборка web workspaces, где задан соответствующий script. |
| `make build-backend` / `make build-web` / `make build-admin` | Сборка соответствующей группы образов; `make build-<service>` собирает один образ. |
| `make list-images` / `make help` | Список допустимых образов / краткие команды. |
| `make run-web` | Запуск web runtime Compose из `web/`; runtime `.env` обязателен. `WEB_BUILD_ENV` остаётся параметром web Compose. |
| `make run-backend` | Запуск backend runtime Compose из `backend/`; его настройки не изменены. |
| `make certs` | Генерация RSA-ключей (2048 bit) в `backend/certs/private.pem` и `backend/certs/public.pem`. |
| `make clean` | Удаление данных MongoDB и MySQL (`backend/mongo_data/`, `backend/mysql_data/`) с подтверждением. Требует sudo. |

## Мониторинг

Prometheus + Grafana — `cd monitoring && docker compose up -d`

## Документация API

Документация всех API-endpoint'ов находится в `docs/api/`. Это статические HTML-страницы без серверной части — просто открой `docs/api/index.html` в браузере.

### Структура

```
docs/api/
├── index.html              # Стартовая страница
├── css/style.css           # Стили (тёмная тема)
├── js/
│   ├── data.js             # Массив ENDPOINTS со всеми 85 endpoint'ами
│   ├── sidebar.js          # Генератор сайдбара, поиск, навигация
│   └── command-renderer.js # Рендер карточек команд
├── system.html             # Системные endpoint'ы
├── auth.html               # Аутентификация
├── users.html              # Пользователи
└── groups/
    ├── general.html        # Группы (CRUD + участники)
    ├── items.html          # Предметы группы
    ├── notes.html          # Заметки группы
    ├── skills.html         # Навыки группы
    ├── schemas.html        # Схемы группы
    ├── quests.html         # Квесты группы
    ├── export-import.html  # Экспорт/Импорт
    └── characters/
        ├── main.html       # Персонажи
        ├── templates.html  # Шаблоны персонажей
        ├── items.html      # Предметы персонажа
        ├── notes.html      # Заметки персонажа
        ├── skills.html     # Навыки персонажа
        └── commands.html   # Команды персонажа
```

### Как добавить новый endpoint

1. Открой `docs/api/js/data.js`.
2. Добавь новый объект в массив `ENDPOINTS` (в соответствующую категорию).
3. Укажи поля: `id`, `method`, `url`, `category`, `categoryTitle`, `page`, `auth`, `access`, `description`, `requestBody`, `responseSchema`, `responseStatuses`, `params`, `special`.
4. Откри́ соответствующую HTML-страницу (по полю `page`) и добавь карточку endpoint'а с тем же `id`.
5. **Важно:** все JSON-схемы должны содержать **фактические поля** из C# моделей, а не устаревшие названия из старых тестов. При изменении моделей на бэкенде — обновляй схемы в `data.js` и HTML.

### Формат JSON-схем

Поля с типом:
```
"fieldName": "string"       // обязательное поле
"fieldName"?: "string"      // опциональное поле
"fieldName": "int | null"   // nullable
```

### Если endpoint переехал на другую страницу

Поменяй поле `page` у соответствующего объекта в `data.js` и перенеси HTML-карточку на новую страницу.
