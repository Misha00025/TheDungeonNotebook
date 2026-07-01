# API Gateway

## Общее описание

API Gateway — единая точка входа в систему. Проксирует запросы к backend-сервисам, проверяет JWT-токены, управляет доступом. Написан на Flask, использует Prometheus для метрик. Не имеет собственной базы данных.

## ENV

| Переменная | Описание | Обязательная |
|---|---|---|
| `AUTH_SERVICE_URL` | URL auth-service | Да |
| `USERS_SERVICE_URL` | URL users-service | Да |
| `CAMPAIGN_SERVICE_URL` | URL campaign-service | Да |
| `NOTES_SERVICE_URL` | URL notes-service | Да |

## Endpoints

### Системные

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/get_api` | Схема всех API методов | Нет |
| `GET` | `/whoami` | Информация о текущем пользователе по JWT | Да |

### Аутентификация

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Регистрация | Нет |
| `POST` | `/auth/login` | Вход | Нет |
| `POST` | `/auth/refresh` | Обновление токена. Header: `Refresh-Token` | Да |

### Пользователи

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/users` | Список пользователей | Нет |
| `POST` | `/users` | Создание пользователя | Да |
| `GET` | `/users/{userId}` | Получение пользователя | Да |
| `PATCH` | `/users/{userId}` | Обновление (только владелец) | Да |

### Группы

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/groups` | Список | Да |
| `POST` | `/groups` | Создание | Да |
| `GET` | `/groups/{groupId}` | Получение | Да |
| `PATCH` | `/groups/{groupId}` | Обновление (только админ) | Да |
| `GET` | `/groups/{groupId}/users` | Участники | Да |
| `PUT` | `/groups/{groupId}/users/{userId}` | Добавление участника (админ) | Да |
| `DELETE` | `/groups/{groupId}/users/{userId}` | Удаление участника (админ) | Да |

### Предметы группы

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/groups/{groupId}/items` | Список | Да |
| `POST` | `/groups/{groupId}/items` | Создание (админ) | Да |
| `GET` | `/groups/{groupId}/items/{itemId}` | Получение | Да |
| `PUT` | `/groups/{groupId}/items/{itemId}` | Обновление (админ) | Да |
| `DELETE` | `/groups/{groupId}/items/{itemId}` | Удаление (админ) | Да |

### Заметки группы

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/groups/{groupId}/notes` | Список (админ) | Да |
| `POST` | `/groups/{groupId}/notes` | Создание (админ) | Да |
| `GET` | `/groups/{groupId}/notes/{noteId}` | Получение (админ) | Да |
| `PUT` | `/groups/{groupId}/notes/{noteId}` | Обновление (админ) | Да |
| `DELETE` | `/groups/{groupId}/notes/{noteId}` | Удаление (админ) | Да |

### Навыки и атрибуты группы

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/groups/{groupId}/skills/attributes` | Атрибуты | Да |
| `PUT` | `/groups/{groupId}/skills/attributes` | Обновление (админ) | Да |
| `GET` | `/groups/{groupId}/skills` | Список навыков | Да |
| `POST` | `/groups/{groupId}/skills` | Создание (админ) | Да |
| `GET` | `/groups/{groupId}/skills/{skillId}` | Получение | Да |
| `PUT` | `/groups/{groupId}/skills/{skillId}` | Обновление (админ) | Да |
| `DELETE` | `/groups/{groupId}/skills/{skillId}` | Удаление (админ) | Да |

### Схемы

| Метод | URL | Auth |
|---|---|---|
| `GET` | `/groups/{groupId}/schemas/items` | Да |
| `PUT` | `/groups/{groupId}/schemas/items` | Обновление (админ) |
| `GET` | `/groups/{groupId}/schemas/skills` | Да |
| `PUT` | `/groups/{groupId}/schemas/skills` | Обновление (админ) |
| `GET` | `/groups/{groupId}/schemas/template` | Да |
| `PUT` | `/groups/{groupId}/schemas/template` | Обновление (админ) |

### Персонажи

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/groups/{groupId}/characters` | Список | Да |
| `POST` | `/groups/{groupId}/characters` | Создание (админ) | Да |
| `GET` | `/groups/{groupId}/characters/{characterId}` | Получение | Да |
| `PATCH` | `/groups/{groupId}/characters/{characterId}` | Обновление (canWrite) | Да |
| `DELETE` | `/groups/{groupId}/characters/{characterId}` | Удаление (canWrite) | Да |
| `GET` | `/groups/{groupId}/characters/{characterId}/users` | Список с правами | Да |
| `PUT` | `/groups/{groupId}/characters/{characterId}/users/{userId}` | Установка прав | Да |
| `DELETE` | `/groups/{groupId}/characters/{characterId}/users/{userId}` | Удаление прав | Да |

### Шаблоны персонажей

| Метод | URL | Описание | Auth |
|---|---|---|---|
| `GET` | `/groups/{groupId}/characters/templates` | Список | Да |
| `POST` | `/groups/{groupId}/characters/templates` | Создание (админ) | Да |
| `PUT` | `/groups/{groupId}/characters/templates` | Обновление (админ) | Да |
| `GET` | `/groups/{groupId}/characters/templates/{templateId}` | Получение | Да |
| `PUT` | `/groups/{groupId}/characters/templates/{templateId}` | Обновление (админ) | Да |

### Предметы, заметки, навыки персонажа

| Метод | URL | Auth |
|---|---|---|
| `GET` / `POST` | `/groups/{groupId}/characters/{characterId}/items` | Да |
| `GET` / `PUT` / `DELETE` | `/groups/{groupId}/characters/{characterId}/items/{itemId}` | Да |
| `GET` / `POST` | `/groups/{groupId}/characters/{characterId}/notes` | Да |
| `GET` / `PUT` / `DELETE` | `/groups/{groupId}/characters/{characterId}/notes/{noteId}` | Да |
| `GET` | `/groups/{groupId}/characters/{characterId}/skills` | Да |
| `PUT` / `DELETE` | `/groups/{groupId}/characters/{characterId}/skills/{skillId}` | Да |
