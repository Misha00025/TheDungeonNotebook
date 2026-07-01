# Users Service

## Общее описание

Сервис управления пользователями. CRUD для профилей пользователей. Использует MySQL (таблицы `user` и `linked_services`). Не вызывает другие сервисы, не содержит JWT-валидации (аутентификация на уровне API Gateway).

## ENV

| Переменная | Описание | Обязательная |
|---|---|---|
| `MYSQL_CONNECTION_STRING` | Строка подключения к MySQL | Да |
| `MYSQL_DATABASE` | Имя базы данных MySQL | Да |

## Формат ответа пользователя

```json
{
  "id": int,
  "nickname": string,
  "visibleName": string,
  "imageLink": string
}
```

## Endpoints

### Список пользователей

```
GET /users
```

Query: `?ids=1,2,3&nickname=...`

- `200` — `{ "users": [...] }`

### Создание пользователя

```
POST /users
```

Body: `{ "id": int, "nickname": string, "visibleName"?: string, "imageLink"?: string }`

- `201` — с Location header
- `400` — Bad Request
- `409` — Conflict

### Получение пользователя

```
GET /users/{userId}
```

- `200` — `{ "id", "nickname", "visibleName", "imageLink" }`
- `404` — Not Found

### Обновление пользователя

```
PATCH /users/{userId}
```

Body: `{ "visibleName"?: string, "imageLink"?: string }`

- `200` — OK
- `400` — Bad Request
- `404` — Not Found

### Удаление пользователя

```
DELETE /users/{userId}
```

- `200` — OK
- `404` — Not Found
