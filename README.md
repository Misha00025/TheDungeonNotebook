# The Dungeon Notebook

Лучшая записная книжка любителя подземелий и других приключенческих штук :)

## Архитектура

API Gateway (Flask, порт 5000) — единая точка входа. Проксирует запросы к микросервисам:

- **api-gateway** (Python/Flask) — [README](backend/api-gateway/README.md)
- **auth-service** (C# .NET 8) — [README](backend/auth-service/README.md)
- **users-service** (C# .NET 8) — [README](backend/users-service/README.md)
- **campaign-service** (C# .NET 8) — [README](backend/campaign-service/README.md)
- **notes-service** (C# .NET 8) — [README](backend/notes-service/README.md)
- **uploads-service** (C# .NET 8) — [README](backend/uploads-service/README.md)

### Базы данных

- **MySQL 8.0** — auth-service, users-service, campaign-service
- **MongoDB** — campaign-service, notes-service

## Переменные окружения (.env)

| Переменная | Описание |
|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | Пользователь MongoDB |
| `MONGO_INITDB_ROOT_PASSWORD` | Пароль MongoDB |
| `MYSQL_ROOT_PASSWORD` | Root-пароль MySQL |
| `MYSQL_DATABASE` | Имя базы данных MySQL |
| `MYSQL_USER` | Пользователь MySQL |
| `MYSQL_PASSWORD` | Пароль MySQL |
| `SERVICE_TOKEN` | Сервисный токен |

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
1. MySQL + MongoDB
2. auth-service, users-service, campaign-service, notes-service
3. api-gateway

### Запуск uploads-service (отдельно)

```bash
cd backend/uploads-service
docker compose up -d
```

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
│   ├── data.js             # Массив ENDPOINTS со всеми 69 endpoint'ами
│   └── sidebar.js          # Генератор сайдбара, поиск, навигация
├── system.html             # Системные endpoint'ы
├── auth.html               # Аутентификация
├── users.html              # Пользователи
└── groups/
    ├── general.html        # Группы (CRUD + участники)
    ├── items.html          # Предметы группы
    ├── notes.html          # Заметки группы
    ├── skills.html         # Навыки группы
    ├── schemas.html        # Схемы группы
    ├── export-import.html  # Экспорт/Импорт
    └── characters/
        ├── main.html       # Персонажи
        ├── templates.html  # Шаблоны персонажей
        ├── items.html      # Предметы персонажа
        ├── notes.html      # Заметки персонажа
        └── skills.html     # Навыки персонажа
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
