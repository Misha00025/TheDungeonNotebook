# API Gateway

Единая точка входа в систему. Проксирует запросы к backend-сервисам, проверяет JWT-токены, управляет доступом.

**Стек:** Python / FastAPI + Uvicorn, [PyApiGate 0.1.1](https://github.com/misha00025/pyapi-gate)

---

## Содержание

- [Архитектура](#архитектура)
- [Конфигурация (routes.yaml)](#конфигурация-routesyaml)
- [Access-хендлеры](#access-хендлеры)
- [Response-хендлеры](#response-хендлеры)
- [Структура проекта](#структура-проекта)
- [ENV](#env)
- [Запуск тестов](#запуск-тестов)

---

## Архитектура

Gateway работает на **декларативном движке PyApiGate**: все маршруты, права доступа и правила проксирования описываются в YAML-конфиге.

Движок живёт во внешнем образе `ghcr.io/misha00025/pyapi-gate:0.1.1`. В этом репозитории — только кастомный код:
- `configs/routes.yaml` — декларативная конфигурация маршрутов
- `handlers/` — кастомные access и response хендлеры
- `main.py` — точка входа для uvicorn

**Pipeline обработки запроса:**

```
Входящий запрос
  │
  ├─ 1. Auth middleware — локальная проверка RSA JWT (публичный ключ)
  ├─ 2. Access handler — вызов хендлера по имени из YAML
  ├─ 3. Param injection — подстановка userId из JWT, параметров из path
  └─ 4. Execute — прокси в бэкенд ИЛИ вызов response-хендлера
```

---

## Конфигурация (routes.yaml)

Файл: `configs/routes.yaml`

Прокси-маршрут:

```yaml
- path: /groups/{group_id}/items
  methods: [GET, POST]
  proxy:
    service: campaign
    path: /groups/{group_id}/items
  auth: required
  access:
    GET: group_member
    POST: group_admin
```

Кастомный маршрут (response handler):

```yaml
- path: /groups/{group_id}/users
  methods: [GET]
  handler: group_users
  auth: required
  access: group_member
```

Multi-method формат (методы с разной конфигурацией):

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

### Auth на корневом уровне

```yaml
auth:
  strategy: rsa_jwt
  public_key_path: ${PUBLIC_KEY_PATH:-/certs/public.pem}
  expected_issuer: "${OIDC_ISSUER}"
```

### Подстановка переменных

URL сервисов поддерживают подстановку `${ENV_VAR}` и `${ENV_VAR:-default}`:

```yaml
services:
  auth:      { base_url: "${AUTH_SERVICE_URL}" }
  users:     { base_url: "${USERS_SERVICE_URL}" }
  campaign:  { base_url: "${CAMPAIGN_SERVICE_URL}" }
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

Специальное значение `"*"` для query форвардит все входящие параметры.

### Особые случаи

**PUT без тела (skill assignment):**
```yaml
skip_body: true
```

**Обёртка ответа:**
```yaml
response:
  wrap: notes      # оборачивает ответ в {"notes": [...]}
```

---

## Access-хендлеры

Access-хендлер проверяет, имеет ли пользователь право выполнить запрос. Регистрируется декоратором и вызывается по имени из YAML. **Функции синхронные.**

**Где писать:** `handlers/access.py`

**Сигнатура:**
```python
from app.engine.context import RouteContext
from app.engine.registry import register_access_handler
from app.engine.status import forbidden

@register_access_handler("my_custom_check")
def my_check(ctx: RouteContext):
    """
    ctx.request      — FastAPI Request
    ctx.path_params  — {"group_id": 1, "character_id": 42}
    ctx.jwt          — {"userId": 7, ...} или None
    ctx.services     — ServiceRegistry
    ctx.state        — mutable dict для передачи данных
    """
    resp = ctx.services.campaign.get(f"/groups/{ctx.path_params['group_id']}")

    if condition:
        return ctx.allow()
    return ctx.deny(forbidden_response)
```

**Встроенные хендлеры:**

| Имя | Что проверяет |
|---|---|
| `group_member` | Пользователь — участник группы (user token) ИЛИ группа совпадает (group token) |
| `group_admin` | Пользователь — администратор группы |
| `character_viewer` | Пользователь имеет доступ к персонажу (read или write) |
| `character_writer` | Пользователь может писать в персонажа (canWrite или admin) |
| `character_admin` | Пользователь — администратор группы (для управления доступом к персонажу) |
| `self_only` | Пользователь редактирует свой профиль (`jwt.userId == path.user_id`) |
| `quest_writer` | Пользователь может писать в квест (canWrite назначенного персонажа или admin) |

---

## Response-хендлеры

Response-хендлер обрабатывает запрос полностью и возвращает Response. Используется для endpoint'ов, которые не являются простым прокси. **Функции асинхронные.**

**Где писать:** `handlers/responses.py`

**Сигнатура:**
```python
from app.engine.context import RouteContext
from app.engine.registry import register_response_handler
from app.engine.status import ok
from starlette.responses import Response

@register_response_handler("my_handler")
async def my_handler(ctx: RouteContext) -> Response:
    data = await ctx.request.json()
    return ok({"result": "ok"})
```

**Встроенные хендлеры:**

| Имя | Назначение |
|---|---|
| `get_api` | Возвращает схему всех API-методов |
| `whoami` | Декодирует JWT, возвращает `{id, type}` ("user" / "group") |
| `user_create` | Создаёт пользователя с принудительной подстановкой `id` из JWT |
| `group_users` | Оркестрирует policy + users: возвращает список участников группы |
| `character_users` | Оркестрирует policy + users: возвращает список пользователей персонажа |
| `group_export` | Экспорт данных группы с кастомными параметрами |
| `group_import` | Импорт данных группы |
| `quest_create_for_character` | Создаёт квест с принудительным `assignedCharacters` из персонажа |

---

## Структура проекта

```
api-gateway/
├── configs/
│   └── routes.yaml              # ~130 endpoint'ов
├── handlers/
│   ├── __init__.py               # Явный импорт access + responses
│   ├── access.py                 # group_member, group_admin, character_writer, ...
│   └── responses.py              # whoami, group_users, export, import, ...
├── main.py                       # import handlers; create_app()
├── Dockerfile                    # FROM ghcr.io/misha00025/pyapi-gate:0.1.1
├── rules.md
└── tests/
    ├── test.sh                   # Оркестратор тестов
    ├── test-ci.sh                # CI-версия
    └── README.md                 # Документация тестового фреймворка
```

---

## ENV

| Переменна | Описание | Обязательная |
|---|---|---|
| `AUTH_SERVICE_URL` | URL auth-service | Да |
| `USERS_SERVICE_URL` | URL users-service | Да |
| `CAMPAIGN_SERVICE_URL` | URL campaign-service | Да |
| `PUBLIC_KEY_PATH` | Путь к публичному RSA-ключу | Нет (default: `/certs/public.pem`) |
| `OIDC_ISSUER` | Issuer для проверки JWT | Да |
| `CONFIG_PATH` | Путь к routes.yaml | Нет (default: `/app/configs/routes.yaml`) |

---

## Запуск тестов

```bash
cd tests
./test.sh 15 [-S ScenarioName]
```

`test.sh` сам поднимает docker-compose, чистит БД, запускает тесты и гасит контейнеры.

Для CI:

```bash
./test-ci.sh [-S ScenarioName]
```

Подробнее — в `tests/README.md`.
