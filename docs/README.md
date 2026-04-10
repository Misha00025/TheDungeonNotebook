# The Dungeon Notebook - Сводная документация

## Введение

Данный документ содержит сводную информацию о микросервисной архитектуре проекта **The Dungeon Notebook**. Проект представляет собой систему для управления игровыми кампаниями, персонажами и заметками в формате RPG.

Архитектура проекта основана на микросервисах, каждый из которых отвечает за конкретную функциональность:

- **Auth Service** — аутентификация и авторизация пользователей
- **Users Service** — управление пользователями и их профилями
- **Groups Service** — управление группами и персонажами
- **Notes Service** — хранение заметок по персонажам и группам
- **Policy Service** — управление политиками доступа
- **Schemas Service** — управление схемами и шаблонами
- **API Gateway** — единая точка входа для всех запросов

---

## Архитектура сервисов

### Auth Service

[Раздел для документации Auth Service](./auth-service.md)

### Users Service

[Раздел для документации Users Service](./users-service.md)

### Groups Service

[Раздел для документации Groups Service](./groups-service.md)

### Notes Service

[Раздел для документации Notes Service](./notes-service.md)

### Policy Service

[Раздел для документации Policy Service](./policy-service.md)

### Schemas Service

[Раздел для документации Schemas Service](./schemas-service.md)

### Campaign Service

[Раздел для документации Campaign Service](./campaign-service.md)

---

## Авторизация

Раздел, описывающий механизмы авторизации и аутентификации в системе.

### Методы аутентификации

- [JWT токены](#jwt-токены)
- [Сессии](#сессии)

### Ролевая модель

- [Администраторы](#администраторы)
- [Мастера кампаний](#мастера-кампаний)
- [Участники](#участники)

---

## Получение данных

Раздел, описывающий механизмы получения данных из различных сервисов.

### Форматы данных

- [JSON](#json)
- [XML](#xml)

### Кэширование

- [Стратегии кэширования](#стратегии-кэширования)

---

## API Proxy

[Документация API Proxy](./api-proxy.md)

---

### 1. Сводная информация

API Proxy — это единая точка входа для всех запросов к микросервисам системы. Он предоставляет два уровня API:

- **v0** — базовые endpoints для аутентификации и получения списка групп
- **v1** — расширенные endpoints для CRUD операций над заметками, группами, пользователями и предметами

**Всего endpoints:** 16 (4 в v0, 12 в v1)

**Используемые сервисы:**
- `auth-service` — аутентификация и проверка прав
- `backend-service` — основная бизнес-логика
- `VK API` — получение информации о пользователях

---

### 2. Классификация endpoints

| Категория | Количество | Endpoints |
|-----------|------------|-----------|
| Авторизация/Проверка прав | 2 | `/api/auth`, `/api/check_access` |
| Получение данных | 14 | `/api/get_api`, `/api/groups`, `/api/v1/*` |

---

### 3. API v0 — Базовые endpoints

#### 3.1 `/api/get_api`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| — | — | — | — |

- **Метод:** `GET`
- **Доступ:** `all` (без авторизации)
- **Сервисы:** — (информационный endpoint)
- **Описание:** Возвращает список всех доступных API методов

**Ответ (200 OK):**
```json
{
  "api_methods": {
    "v0": [...],
    "v1": [...]
  }
}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/get_api"
```

---

#### 3.2 `/api/auth`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `access_token` | string | Да (в ответе) | Токен авторизации пользователя |

- **Метод:** `POST`
- **Доступ:** `all` (без авторизации)
- **Сервисы:** `auth-service`
- **Описание:** Конвертация сервисного токена VK в токен доступа пользователя

**Запрос:**
```json
{
  "access_token": "VK_ID_from_vk"
}
```

**Ответ (200 OK):**
```json
{
  "access_token": "user_access_token"
}
```

**Пример запроса:**
```bash
curl -X POST "http://api-proxy:8000/api/auth" \
  -H "Content-Type: application/json" \
  -d '{"access_token": "VK_ID_from_vk"}'
```

---

#### 3.3 `/api/check_access`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| — | — | — | — |

- **Метод:** `GET`
- **Доступ:** `users_and_groups`
- **Сервисы:** `auth-service`
- **Описание:** Проверка типа доступа (user/group)

**Ответ (200 OK):**
```json
{
  "access.type": "user \| group"
}
```

**Ответ (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/check_access" \
  -H "Authorization: Bearer {user_token}"
```

---

#### 3.4 `/api/groups`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| — | — | — | — |

- **Метод:** `GET`
- **Доступ:** `users`
- **Сервисы:** `backend-service`
- **Описание:** Получение списка всех групп

**Ответ (200 OK):**
```json
{
  "groups": [
    {
      "id": 1,
      "name": "Название группы",
      "privileges": []
    }
  ]
}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/groups" \
  -H "Authorization: Bearer {user_token}"
```

---

### 4. API v1 — Расширенные endpoints

#### 4.1 `/api/v1/notes`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| — | — | — | — |

- **Метод:** `GET`
- **Доступ:** `users_and_groups`
- **Сервисы:** `backend-service`
- **Описание:** Получение списка всех заметок группы

**Ответ (200 OK):**
```json
{
  "notes": [
    {
      "id": 1,
      "header": "Заголовок",
      "body": "Текст заметки",
      "last_modify": "2026-04-10 06:00:00",
      "group_id": 1,
      "owner_id": 1,
      "author": {
        "vk_id": 123,
        "first_name": "Иван",
        "last_name": "Иванов",
        "photo": "https://..."
      }
    }
  ]
}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/v1/notes" \
  -H "Authorization: Bearer {user_token}"
```

---

#### 4.2 `/api/v1/notes/{note_id}`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `note_id` | string | Да | ID заметки (формат: `{character_id}{note_index}`) |

- **Методы:** `GET`, `PUT`, `DELETE`
- **Доступ:** `users_and_groups`
- **Сервисы:** `backend-service`
- **Описание:** CRUD операции над конкретной заметкой

**GET — Ответ (200 OK):**
```json
{
  "id": 1,
  "header": "Заголовок",
  "body": "Текст заметки",
  "last_modify": "2026-04-10 06:00:00",
  "group_id": 1,
  "owner_id": 1,
  "author": {
    "vk_id": 123,
    "first_name": "Иван",
    "last_name": "Иванов",
    "photo": "https://..."
  }
}
```

**PUT — Запрос:**
```json
{
  "header": "Новый заголовок",
  "body": "Новое тело"
}
```

**PUT — Ответ (200 OK):**
```json
{
  "id": 1,
  "header": "Новый заголовок",
  "body": "Новое тело",
  "last_modify": "2026-04-10 06:05:00",
  "group_id": 1,
  "owner_id": 1,
  "author": {
    "vk_id": 123,
    "first_name": "Иван",
    "last_name": "Иванов",
    "photo": "https://..."
  }
}
```

**DELETE — Ответ (204 No Content):**
```json
{}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/v1/notes/123" \
  -H "Authorization: Bearer {user_token}"
```

---

#### 4.3 `/api/v1/notes/add`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `header` | string | Да | Заголовок заметки |
| `body` | string | Да | Тело заметки |
| `group_id` | integer | Да (для пользователя) | ID группы |
| `user_id` | integer | Да (для группы) | ID пользователя |

- **Метод:** `POST`
- **Доступ:** `users_and_groups`
- **Сервисы:** `backend-service`
- **Описание:** Создание новой заметки

**Запрос:**
```json
{
  "header": "Новая заметка",
  "body": "Текст заметки",
  "group_id": 1
}
```

**Ответ (201 Created):**
```json
{
  "last_id": 1
}
```

**Пример запроса:**
```bash
curl -X POST "http://api-proxy:8000/api/v1/notes/add" \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"header": "Новая заметка", "body": "Текст заметки", "group_id": 1}'
```

---

#### 4.4 `/api/v1/groups`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| — | — | — | — |

- **Метод:** `GET`
- **Доступ:** `users_and_groups`
- **Сервисы:** `backend-service`
- **Описание:** Получение списка групп с правами доступа

**Ответ (200 OK) — от имени пользователя:**
```json
{
  "groups": [
    {
      "id": 1,
      "is_admin": true,
      "name": "Название группы"
    }
  ]
}
```

**Ответ (200 OK) — от имени группы:**
```json
{
  "id": 1,
  "name": "Название группы",
  "admins": [
    {
      "id": 123,
      "first_name": "Админ",
      "last_name": "Админов"
    }
  ],
  "users": [
    {
      "id": 456,
      "first_name": "Пользователь",
      "last_name": "Пользователь"
    }
  ]
}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/v1/groups" \
  -H "Authorization: Bearer {user_token}"
```

---

#### 4.5 `/api/v1/groups/{group_id}`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `group_id` | integer | Да | ID группы |

- **Метод:** `GET`
- **Доступ:** `users_and_groups`
- **Сервисы:** `backend-service`
- **Описание:** Получение информации о конкретной группе

**Ответ (200 OK):**
```json
{
  "id": 1,
  "name": "Название группы",
  "admins": [
    {
      "id": 123,
      "first_name": "Админ",
      "last_name": "Админов"
    }
  ],
  "is_admin": true,
  "users": [
    {
      "id": 456,
      "first_name": "Пользователь",
      "last_name": "Пользователь"
    }
  ]
}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/v1/groups/1" \
  -H "Authorization: Bearer {user_token}"
```

---

#### 4.6 `/api/v1/users`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| — | — | — | — |

- **Метод:** `GET`
- **Доступ:** `users_and_groups`
- **Сервисы:** `backend-service`
- **Описание:** Получение списка пользователей/админов

**Ответ (200 OK) — от имени группы:**
```json
{
  "admins": [
    {
      "id": 123,
      "first_name": "Админ",
      "last_name": "Админов"
    }
  ],
  "users": [
    {
      "id": 456,
      "first_name": "Пользователь",
      "last_name": "Пользователь"
    }
  ]
}
```

**Ответ (200 OK) — от имени пользователя:**
```json
{
  "id": 123,
  "first_name": "Иван",
  "last_name": "Иванов",
  "photo_link": "https://..."
}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/v1/users" \
  -H "Authorization: Bearer {user_token}"
```

---

#### 4.7 `/api/v1/users/{user_id}`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `user_id` | integer | Да | ID пользователя |

- **Методы:** `GET`, `DELETE`
- **Доступ:** `groups`
- **Сервисы:** `backend-service`
- **Описание:** Получение/удаление информации о пользователе

**GET — Ответ (200 OK):**
```json
{
  "id": 123,
  "first_name": "Иван",
  "last_name": "Иванов",
  "photo_link": "https://..."
}
```

**DELETE — Ответ (204 No Content):**
```json
{}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/v1/users/123" \
  -H "Authorization: Bearer {group_token}"
```

---

#### 4.8 `/api/v1/users/add`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `user_id` | integer | Да | ID пользователя |
| `is_admin` | boolean | Да | Статус администратора |

- **Метод:** `POST`
- **Доступ:** `groups`
- **Сервисы:** `backend-service`
- **Описание:** Добавление нового пользователя

**Запрос:**
```json
{
  "user_id": 123,
  "is_admin": true
}
```

**Ответ (201 Created):**
```json
{
  "user_id": 123,
  "is_admin": true
}
```

**Пример запроса:**
```bash
curl -X POST "http://api-proxy:8000/api/v1/users/add" \
  -H "Authorization: Bearer {group_token}" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 123, "is_admin": true}'
```

---

#### 4.9 `/api/v1/items`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `group_id` | integer | Да (для пользователя) | ID группы |
| `owner_id` | integer | Да (для инвентаря) | ID владельца |

- **Метод:** `GET`
- **Доступ:** `users_and_groups`
- **Сервисы:** `backend-service`
- **Описание:** Получение списка предметов инвентаря

**Ответ (200 OK):**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Меч",
      "description": "Стальной меч",
      "amount": 1,
      "icon": "https://..."
    }
  ]
}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/v1/items" \
  -H "Authorization: Bearer {user_token}"
```

---

#### 4.10 `/api/v1/items/{item_id}`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `item_id` | string | Да | ID или название предмета |

- **Методы:** `GET`, `PUT`, `DELETE`, `POST`
- **Доступ:** `users_and_groups`
- **Сервисы:** `backend-service`
- **Описание:** CRUD операции над предметом

**GET — Ответ (200 OK):**
```json
{
  "id": 1,
  "name": "Меч",
  "description": "Стальной меч",
  "amount": 1,
  "icon": "https://..."
}
```

**PUT — Запрос (от лица группы):**
```json
{
  "name": "Новое название",
  "description": "Новое описание"
}
```

**PUT — Запрос (от лица пользователя):**
```json
{
  "amount": 5
}
```

**PUT — Ответ (200 OK):**
```json
{
  "id": 1,
  "name": "Новое название",
  "description": "Новое описание",
  "amount": 5,
  "icon": "https://..."
}
```

**DELETE — Ответ (204 No Content):**
```json
{}
```

**POST — Запрос (добавление предмета):**
```json
{
  "name": "Новый предмет",
  "description": "Описание",
  "amount": 1
}
```

**POST — Ответ (201 Created):**
```json
{
  "id": 2,
  "name": "Новый предмет",
  "description": "Описание"
}
```

**Пример запроса:**
```bash
curl -X GET "http://api-proxy:8000/api/v1/items/1" \
  -H "Authorization: Bearer {user_token}"
```

---

#### 4.11 `/api/v1/items/create`

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `name` | string | Да | Название предмета |
| `description` | string | Да | Описание предмета |

- **Метод:** `POST`
- **Доступ:** `users_and_groups` (только группы/админы)
- **Сервисы:** `backend-service`
- **Описание:** Создание нового предмета (упрощённый endpoint)

**Запрос:**
```json
{
  "name": "Новый предмет",
  "description": "Описание предмета"
}
```

**Ответ (201 Created):**
```json
{
  "created_item": {
    "id": 2,
    "name": "Новый предмет",
    "description": "Описание предмета"
  }
}
```

**Пример запроса:**
```bash
curl -X POST "http://api-proxy:8000/api/v1/items/create" \
  -H "Authorization: Bearer {group_token}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Новый предмет", "description": "Описание предмета"}'
```

---

### 5. Архитектура взаимодействия с сервисами

```mermaid
graph TB
    subgraph API Proxy
        entry[main.py / wsgi.py]
        controller[app/api_controller.py]
        router_v0[app/api/v0/router.py]
        router_v1[app/api/v1/*]
        processing[app/processing/*]
    end
    
    subgraph Services
        auth[Auth Service]
        backend[Backend Service]
        vk[VK API]
    end
    
    Client[Клиент] --> entry
    entry --> controller
    controller --> router_v0
    controller --> router_v1
    router_v0 --> processing
    router_v1 --> processing
    
    processing --> auth
    processing --> backend
    processing --> vk
```

---

### 6. Матрица сопоставления Endpoint → Сервис

| Endpoint | Сервис | URL сервиса | Описание взаимодействия |
|----------|--------|-------------|-------------------------|
| `/api/auth` | auth-service | `{AUTH_SERVICE_URL}/whoami` | Конвертация сервисного токена в токен доступа |
| `/api/check_access` | auth-service | `{AUTH_SERVICE_URL}/whoami` | Проверка типа доступа |
| `/api/v1/notes*` | backend-service | `{BACKEND_SERVICE_URL}/notes/*` | CRUD операции над заметками |
| `/api/v1/groups*` | backend-service | `{BACKEND_SERVICE_URL}/groups/*` | CRUD операции над группами |
| `/api/v1/users*` | backend-service | `{BACKEND_SERVICE_URL}/users/*` | CRUD операции над пользователями |
| `/api/v1/items*` | backend-service | `{BACKEND_SERVICE_URL}/items/*` | CRUD операции над предметами |
| `/api/v1/items/*/{item_id}` | backend-service | `{BACKEND_SERVICE_URL}/items/{item_id}` | CRUD операции над предметами |
| `/api/v1/notes/{note_id}/characters` | backend-service | `{BACKEND_SERVICE_URL}/notes/{note_id}/characters` | Получение ID персонажа для группы |
| `/api/v1/items/*/{item_id}/characters` | backend-service | `{BACKEND_SERVICE_URL}/items/{item_id}/characters` | Получение ID персонажа для предмета |
| — | VK API | `https://api.vk.com/method/users.get` | Получение информации о пользователе от VK |

---

### 7. Диаграмма потоков данных

```mermaid
sequenceDiagram
    participant Client as Клиент
    participant Proxy as API Proxy
    participant Parser as Parser
    participant Auth as Auth Service
    participant Backend as Backend Service
    participant VK as VK API
    
    Client->>Proxy: HTTP Запрос
    Note over Proxy: Проверка токенов
    Proxy->>Parser: get_whoami()
    alt Токен не найден
        Proxy-->>Client: 401 Unauthorized
    else Токен найден
        Parser-->>Proxy: Информация о пользователе
        Proxy->>Parser: get_group_id()
        alt group_id не найден
            Proxy-->>Client: 400 Bad Request
        else group_id найден
            Proxy->>Parser: get_user_id()
            alt user_id не найден
                Proxy-->>Client: 400 Bad Request
            else user_id найден
                Proxy->>Backend: Перенаправление запроса
                Backend-->>Proxy: Ответ от backend
                Proxy-->>Client: Форматированный ответ
            end
        end
    end
```

---

### 8. Статус реализации

| Компонент | Статус | Примечания |
|-----------|--------|------------|
| v0 endpoints | ✅ Реализовано | get_api, auth, check_access, groups |
| v1 notes | ✅ Реализовано | GET, PUT, DELETE, POST |
| v1 groups | ✅ Реализовано | GET |
| v1 users | ✅ Реализовано | GET, DELETE, POST |
| v1 items | ⚠️ Частично | GET реализован, PUT/POST/DELETE не реализованы |
| Парсинг запросов | ✅ Реализовано | request_parser.py |
| Обработка запросов | ✅ Реализовано | common_methods.py, vk_methods.py |

---

### 9. Следующие шаги

1. Реализовать PUT/POST/DELETE для items
2. Добавить валидацию входных данных
3. Добавить обработку ошибок
4. Добавить документацию по ошибкам
5. Добавить примеры запросов в curl/bash формат

---

### 10. Заключение

Всего обнаружено **16 API endpoints** в API Proxy:
- **4 endpoint** в версии v0 (базовые)
- **12 endpoint** в версии v1 (расширенные)

Все endpoints (кроме `/api/get_api`) взаимодействуют с **backend-service**.
Один endpoint (`/api/auth`) взаимодействует с **auth-service**.
Один endpoint использует **VK API** для получения информации о пользователях.

---

## Мониторинг

[Информация о мониторинге](../monitoring/)

---

## Планы и спецификации

[Планы разработки](./plans/)
