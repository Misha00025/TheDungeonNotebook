# GAPS — отсутствующий функционал бэкенда

Функции, которые невозможно реализовать в админ-панели без добавления новых эндпоинтов в C#-сервисы.

---

## GAP 1: Смена пароля пользователя

**Блокирует:** возможность администратора сбросить/сменить пароль пользователя.

**Нужный эндпоинт:** `POST /auth/password-change`

**Тело запроса:**
```json
{
  "userId": 1,
  "newPassword": "new-secret-password"
}
```

**Где отсутствует:** `backend/auth-service/Source/Controllers/AuthController.cs`

**Что есть сейчас:** `register`, `login`, `token/refresh`, `service-token/generate`, `check` — ни один не меняет пароль.

---

## GAP 2: Получение username по user_id

**Блокирует:** отображение логина (username) в списке пользователей и на странице деталей. Users-service не хранит username, auth-service не отдаёт его.

**Нужный эндпоинт:** `GET /auth/users/{id}`

**Ответ:**
```json
{
  "id": 1,
  "username": "misha"
}
```

Или batch: `GET /auth/users?ids=1,2,3` → `{ "users": [{ "id": 1, "username": "misha" }, ...] }`

**Где отсутствует:** `backend/auth-service/Source/Controllers/AuthController.cs`

**Что есть сейчас:** `check` — только валидация токена, без данных пользователя.
