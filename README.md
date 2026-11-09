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

### Подготовка и команды web

```bash
cp web/template.env web/.env
npm ci --prefix web
make check-web
make build
make run
```

Compose для web использует рабочий каталог `web/`; runtime `.env` обязателен. Build-переменные по умолчанию берутся из `web/template.env.build`; путь можно переопределить, например `make build WEB_BUILD_ENV=.env.build`. `make build` и `make run` также выполняют существующие backend-команды в `backend/`, поэтому требуют предварительно настроенного backend (см. следующий раздел).

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
| `make build` | Backend и web: `make build-backend build-web`. Для отдельных частей используйте эти targets. |
| `make run` | Запуск backend и web: `make run-backend run-web`; web требует `web/.env`. |
| `make check-web` | Web typecheck, тесты и сборка. |
| `make web-install` | Установка web workspace через `npm ci`. |
| `make web-typecheck` | Typecheck web workspaces, где задан соответствующий script. |
| `make web-test` / `make test-web` | Web tests (`npm run test:run`). |
| `make web-build` | Сборка web workspaces, где задан соответствующий script. |
| `make build-web` / `make run-web` | Сборка/запуск web Compose из `web/`; build env задаёт `WEB_BUILD_ENV`. |
| `make build-backend` / `make run-backend` | Существующие backend Compose build/up команды из `backend/`. |
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
