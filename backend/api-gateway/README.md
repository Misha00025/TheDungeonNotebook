# API Gateway

Единая точка входа в систему. Проксирует запросы к backend-сервисам, проверяет JWT-токены, управляет доступом.

**Стек:** Python / Flask 3.x, Gunicorn, Prometheus

---

## Содержание

- [Архитектура](#архитектура)
- [Конфигурация (routes.yaml)](#конфигурация-routesyaml)
  - [Базовые поля](#базовые-поля)
  - [Прокси-маршрут](#прокси-маршрут)
  - [Кастомный маршрут](#кастомный-маршрут)
  - [Подстановка параметров](#подстановка-параметров)
  - [Особые случаи](#особые-случаи)
- [Access-хендлеры](#access-хендлеры)
- [Response-хендлеры](#response-хендлеры)
- [Структура проекта](#структура-проекта)
- [ENV](#env)
- [Endpoints](#endpoints)

---

## Архитектура

Gateway работает на **декларативном движке**: все маршруты, права доступа и правила проксирования описываются в YAML-конфиге.

```
routes.yaml
    │
    ▼
┌────────────────────────────┐
│         Engine             │  ← app/engine/ — переиспользуемый движок
│  (парсинг YAML → pipeline) │     не знает про бизнес-логику
└────────┬───────────────────┘
         │ вызов по имени
         ▼
┌────────────────────────────┐
│      Handlers              │  ← app/handlers/ — твоя бизнес-логика
│  (access + response)       │     group_member, character_writer, ...
└────────────────────────────┘
```

**Pipeline обработки запроса:**

```
Входящий запрос
  │
  ├─ 1. Auth middleware — проверка JWT через auth-service
  ├─ 2. Access handler — вызов твоего хендлера по имени из YAML
  ├─ 3. Param injection — подстановка userId из JWT, параметров из path
  └─ 4. Execute — прокси в бэкенд ИЛИ вызов response-хендлера
```

Движок даёт только инфраструктуру. **Вся бизнес-логика проверок доступа** (кто такой «админ группы», что такое «canWrite») — в твоих хендлерах.

---

## Конфигурация (routes.yaml)

Файл: `app/config/routes.yaml`

### Базовые поля

```yaml
# Префикс URL для всех маршрутов.
# Пустая строка "" — маршруты прямо на /groups/...
# "/v2" — маршруты на /v2/groups/...
base_path: ""

# Бэкенд-сервисы, в которые проксируются запросы
services:
  auth:      { base_url: "http://auth-service:8080" }
  users:     { base_url: "http://users-service:8080" }
  campaign:  { base_url: "http://campaign-service:8080" }

# Маршруты
routes:
  - path: /hello
    ...
```

### Прокси-маршрут

Простой прокси в бэкенд-сервис:

```yaml
- path: /groups/{group_id}/items
  methods: [GET, POST]
  proxy:
    service: campaign       # имя из секции services
    path: /groups/{group_id}/items   # целевой путь (с {placeholders})
  auth: required            # none | required
  access:                   # имя access-хендлера (опционально)
    GET: group_member       #   строка — для всех методов
    POST: group_admin       #   словарь — для каждого метода свой
```

### Кастомный маршрут (handler)

Для endpoint'ов со сложной логикой (оркестрация нескольких сервисов, локальный ответ):

```yaml
- path: /groups/{group_id}/users
  methods: [GET]
  handler: group_users       # имя response-хендлера
  auth: required
  access: group_member
```

### Multi-method формат

Когда для каждого HTTP-метода своя конфигурация:

```yaml
- path: /groups/{group_id}
  methods:
    GET:
      proxy:
        service: campaign
        path: /groups/{group_id}
      auth: required
      params:
        query:
          userId: "{jwt.userId}"
    PATCH:
      proxy:
        service: campaign
        path: /groups/{group_id}
      auth: required
      access: group_admin
```

### Подстановка параметров

```yaml
params:
  query:                      # параметры для query-строки
    userId: "{jwt.userId}"    #   из JWT-токена
    groupId: "{path.group_id}" #   из URL-параметров
    "*": query                #   остальные query-параметры как есть
  body:                       # параметры для JSON-тела (body injection)
    id: "{jwt.userId}"
```

Специальное значение `"*"` для query форвардит все входящие параметры + `userId` из JWT.

### Особые случаи

**PUT без тела (skill assignment):**
```yaml
- path: /groups/{group_id}/characters/{character_id}/skills/{skill_id}
  methods: [PUT]
  proxy:
    service: campaign
    path: /groups/{group_id}/characters/{character_id}/skills/{skill_id}
    skip_body: true          # не передавать тело запроса
  auth: required
  access: character_writer
```

**Body injection (POST /users):**
```yaml
- path: /users
  methods:
    POST:
      handler: user_create
      auth: required
```

---

## Access-хендлеры

Access-хендлер проверяет, имеет ли пользователь право выполнить запрос. Регистрируется декоратором и вызывается по имени из YAML.

**Где писать:** `app/handlers/access.py`

**Сигнатура:**
```python
from app.engine.context import RouteContext
from app.engine.registry import register_access_handler

@register_access_handler("my_custom_check")
def my_check(ctx: RouteContext):
    """
    ctx.request      — Flask Request
    ctx.path_params  — {"group_id": 1, "character_id": 42}
    ctx.jwt          — {"userId": 7, ...} или None
    ctx.services     — ServiceRegistry (http://campaign-service:8080)
    ctx.state        — mutable dict для передачи данных
    """
    # Можно ходить в любые сервисы
    resp = ctx.services.campaign.get(f"/groups/{ctx.path_params['group_id']}")

    if condition:
        return ctx.allow()              # доступ разрешён
    return ctx.deny(forbidden_response)  # доступ запрещён
```

**Встроенные хендлеры проекта:**

| Имя | Что проверяет | Где используется |
|---|---|---|
| `group_member` | Пользователь — участник группы (user token) ИЛИ группа совпадает (group token) | — |
| `group_admin` | Пользователь — администратор группы | PATCH group, POST/PUT/DELETE items, skills, schemas, templates |
| `character_viewer` | Пользователь имеет доступ к персонажу (read или write) | GET character notes |
| `character_writer` | Пользователь может писать в персонажа (canWrite или admin) | PATCH/DELETE character, POST/PUT/DELETE character items/notes/skills |
| `character_admin` | Пользователь — администратор группы (для управления доступом к персонажу) | PUT/DELETE character users |
| `self_only` | Пользователь редактирует свой профиль (`jwt.userId == path.user_id`) | PATCH /users/{id} |

**Как добавить свой:**
```python
@register_access_handler("super_admin")
def check_super_admin(ctx):
    if ctx.jwt and ctx.jwt.get("role") == "super_admin":
        return ctx.allow()
    return ctx.deny()
```

И в YAML:
```yaml
- path: /admin/panel
  methods: [GET]
  handler: admin_panel
  access: super_admin    # ← твой хендлер
```

---

## Response-хендлеры

Response-хендлер обрабатывает запрос полностью и возвращает Flask Response. Используется для endpoint'ов, которые не являются простым прокси.

**Где писать:** `app/handlers/responses.py`

**Сигнатура:**
```python
from app.engine.context import RouteContext
from app.engine.registry import register_response_handler

@register_response_handler("my_handler")
def my_handler(ctx: RouteContext) -> flask.Response:
    # Любая логика
    return jsonify({"result": "ok"}), 200
```

**Встроенные хендлеры:**

| Имя | Назначение |
|---|---|
| `get_api` | Возвращает схему всех API-методов |
| `whoami` | Декодирует JWT, возвращает `{id, type}` ("user" / "group") |
| `auth_refresh` | Извлекает `Refresh-Token` из заголовка, обновляет токен |
| `user_create` | Создаёт пользователя с принудительной подстановкой `id` из JWT |
| `group_users` | Оркестрирует policy + users: возвращает список участников группы |
| `character_users` | Оркестрирует policy + users: возвращает список пользователей персонажа |
| `group_export` | Экспорт данных группы с кастомными параметрами |
| `group_import` | Импорт данных группы |

---

## Структура проекта

```
api-gateway/
├── app/
│   ├── __init__.py              # Flask app + bootstrap engine
│   ├── api_controller.py        # @route декоратор (legacy, не используется)
│   ├── status.py                # Хелперы HTTP-ответов
│   ├── api/                     # Старые хендлеры (import заблокирован)
│   ├── security/                # JWT-валидация, проверки доступа
│   ├── services/                # HTTP-клиенты для бэкендов
│   ├── engine/                  # ★ ДЕКЛАРАТИВНЫЙ ДВИЖОК
│   │   ├── models.py            #   Dataclass'ы: RouteConfig, ProxyConfig, ...
│   │   ├── context.py           #   RouteContext + AccessResult
│   │   ├── registry.py          #   ServiceRegistry, реестры хендлеров
│   │   ├── loader.py            #   Парсинг YAML → GatewayConfig
│   │   ├── pipeline.py          #   Auth → Access → Execute
│   │   ├── proxy.py             #   HTTP-прокси в бэкенд
│   │   └── bootstrap.py         #   Регистрация Blueprint'ов во Flask
│   ├── handlers/                # ★ ТВОЯ БИЗНЕС-ЛОГИКА
│   │   ├── __init__.py
│   │   ├── access.py            #   group_member, group_admin, character_writer, ...
│   │   └── responses.py         #   whoami, group_users, export, import, ...
│   └── config/
│       └── routes.yaml          # ★ ДЕКЛАРАТИВНЫЙ КОНФИГ (~600 строк, 67 endpoint'ов)
│
├── main.py                      # Dev-сервер
├── wsgi.py                      # Gunicorn entrypoint
├── Dockerfile                   # python:3.13 + Gunicorn
├── req.txt                      # Зависимости
└── tests/
    ├── test.sh                   # Запуск тестов (docker-compose → python test.py → down)
    ├── test.py                   # Entrypoint тестов
    ├── scenarios/                # Тестовые сценарии
    └── tests/                    # Фреймворк тестирования
```

---

## ENV

| Переменная | Описание | Обязательная |
|---|---|---|
| `AUTH_SERVICE_URL` | URL auth-service | Да |
| `USERS_SERVICE_URL` | URL users-service | Да |
| `CAMPAIGN_SERVICE_URL` | URL campaign-service | Да |

---

## Endpoints

### Системные

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/get_api` | Схема всех API | Нет |
| `GET` | `/whoami` | Информация о текущем пользователе/группе | Да |

### Аутентификация

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Регистрация | Нет |
| `POST` | `/auth/login` | Вход | Нет |
| `POST` | `/auth/refresh` | Обновление токена. Header: `Refresh-Token` | Нет |

### Пользователи

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/users` | Список пользователей | Нет |
| `POST` | `/users` | Создание (id из JWT) | Да |
| `GET` | `/users/{id}` | Получение | Да |
| `PATCH` | `/users/{id}` | Обновление (только владелец) | Да |

### Группы

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/groups` | Список групп пользователя | Да |
| `POST` | `/groups` | Создание группы | Да |
| `GET` | `/groups/{id}` | Получение | Да |
| `PATCH` | `/groups/{id}` | Обновление (админ) | Да |
| `GET` | `/groups/{id}/users` | Участники группы | Да |
| `PUT` | `/groups/{id}/users/{userId}` | Добавить участника (админ) | Да |
| `DELETE` | `/groups/{id}/users/{userId}` | Удалить участника (админ) | Да |

### Предметы группы

| Метод | URL | Auth |
|---|---|---|
| `GET` | `/groups/{id}/items` | Да |
| `POST` | `/groups/{id}/items` | Админ |
| `GET` | `/groups/{id}/items/{itemId}` | Да |
| `PUT` | `/groups/{id}/items/{itemId}` | Админ |
| `DELETE` | `/groups/{id}/items/{itemId}` | Админ |

### Заметки группы

| Метод | URL | Auth |
|---|---|---|
| `GET` | `/groups/{id}/notes` | Да |
| `POST` | `/groups/{id}/notes` | Админ |
| `GET` | `/groups/{id}/notes/{noteId}` | Да |
| `PUT` | `/groups/{id}/notes/{noteId}` | Админ |
| `DELETE` | `/groups/{id}/notes/{noteId}` | Админ |
| `GET` | `/groups/{id}/notes/keywords` | Да |

### Навыки и атрибуты группы

| Метод | URL | Auth |
|---|---|---|
| `GET` | `/groups/{id}/skills/attributes` | Да |
| `PUT` | `/groups/{id}/skills/attributes` | Админ |
| `GET` | `/groups/{id}/skills` | Да |
| `POST` | `/groups/{id}/skills` | Админ |
| `GET` | `/groups/{id}/skills/{skillId}` | Да |
| `PUT` | `/groups/{id}/skills/{skillId}` | Админ |
| `DELETE` | `/groups/{id}/skills/{skillId}` | Админ |

### Экспорт и импорт

| Метод | URL | Auth |
|---|---|---|
| `GET` | `/groups/{id}/export?include=...` | Админ |
| `POST` | `/groups/{id}/import?include=...` | Админ |

### Схемы

| Метод | URL | Auth |
|---|---|---|
| `GET` | `/groups/{id}/schemas/items` | Да |
| `PUT` | `/groups/{id}/schemas/items` | Админ |
| `GET` | `/groups/{id}/schemas/skills` | Да |
| `PUT` | `/groups/{id}/schemas/skills` | Админ |
| `GET` | `/groups/{id}/schemas/template` | Да |
| `PUT` | `/groups/{id}/schemas/template` | Админ |

### Персонажи

| Метод | URL | Auth |
|---|---|---|
| `GET` | `/groups/{id}/characters` | Да |
| `POST` | `/groups/{id}/characters` | Админ |
| `GET` | `/groups/{id}/characters/{charId}` | Да |
| `PATCH` | `/groups/{id}/characters/{charId}` | canWrite |
| `DELETE` | `/groups/{id}/characters/{charId}` | canWrite |
| `GET` | `/groups/{id}/characters/{charId}/users` | Да |
| `PUT` | `/groups/{id}/characters/{charId}/users/{userId}` | Админ |
| `DELETE` | `/groups/{id}/characters/{charId}/users/{userId}` | Админ |

### Шаблоны персонажей

| Метод | URL | Auth |
|---|---|---|
| `GET` | `/groups/{id}/characters/templates` | Да |
| `POST` | `/groups/{id}/characters/templates` | Админ |
| `PUT` | `/groups/{id}/characters/templates` | Админ |
| `GET` | `/groups/{id}/characters/templates/{templateId}` | Да |
| `PUT` | `/groups/{id}/characters/templates/{templateId}` | Админ |

### Предметы, заметки, навыки персонажа

| Метод | URL | Auth |
|---|---|---|
| `GET` | `/groups/{id}/characters/{charId}/items` | Да |
| `POST` | `/groups/{id}/characters/{charId}/items` | canWrite |
| `GET` / `PUT` / `DELETE` | `/groups/{id}/characters/{charId}/items/{itemId}` | Да(чтение) / canWrite(запись) |
| `GET` | `/groups/{id}/characters/{charId}/notes` | character_viewer |
| `POST` | `/groups/{id}/characters/{charId}/notes` | canWrite |
| `GET` / `PUT` / `DELETE` | `/groups/{id}/characters/{charId}/notes/{noteId}` | viewer(чтение) / canWrite(запись) |
| `GET` | `/groups/{id}/characters/{charId}/notes/keywords` | character_viewer |
| `GET` | `/groups/{id}/characters/{charId}/skills` | Да |
| `PUT` / `DELETE` | `/groups/{id}/characters/{charId}/skills/{skillId}` | canWrite |

---

## Запуск тестов

```bash
cd tests
sudo ./test.sh 15 --server http://localhost:5000 -d -S GatewayMain -S UserProfile ...
```

`test.sh` сам поднимает docker-compose, чистит БД, запускает тесты и гасит контейнеры.
