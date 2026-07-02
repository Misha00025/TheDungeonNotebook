# Auth Service

## Общее описание

Сервис аутентификации. Отвечает за регистрацию, вход, обновление токенов, проверку токенов и генерацию сервисных токенов для групп. Использует MySQL для хранения пользователей (таблица `auth_data` с полями `user_id`, `username`, `password_hash`). Пароли хэшируются BCrypt. JWT токены подписываются RSA-ключом.

## ENV

| Переменная | Описание | Обязательная |
|---|---|---|
| `MYSQL_CONNECTION_STRING` | Строка подключения к MySQL | Да |
| `MYSQL_DATABASE` | Имя базы данных MySQL | Да |
| `PRIVATE_KEY_PATH` | Путь к RSA приватному ключу в формате PEM | Да |
| `PUBLIC_KEY_PATH` | Путь к RSA публичному ключу в формате PEM | Да |

## Endpoints

### Регистрация

```
POST /auth/register
```

Body: `{ "username": string, "password": string }`

- `201` — `{ "id": int }`
- `409` — Conflict

### Вход

```
POST /auth/login
```

Body: `{ "username": string, "password": string }`

- `200` — `{ "token": "<JWT>" }`
- `401` — Unauthorized

### Обновление токена

```
POST /auth/token/refresh
```

Body: `{ "refreshToken": string }`

- `200` — `{ "accessToken": "<new JWT>" }`
- `401` — Unauthorized

### Генерация сервисного токена

```
POST /auth/groups/{groupId}/service-token/generate
```

Body: `{ "access": int, "years": int? }`

- `200` — `{ "token": "<JWT>" }`

### Проверка токена

```
GET /auth/check
Header: Authorization: Bearer {token}
```

- `200` — OK
- `401` — Unauthorized
