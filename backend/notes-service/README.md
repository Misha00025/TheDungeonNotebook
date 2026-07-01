# Notes Service

## Общее описание

Сервис заметок. Хранит заметки групп и персонажей в MongoDB (коллекции `group_notes`, `character_notes`). Использует автоинкрементные ID через коллекцию `counters`. Не вызывает другие сервисы.

## ENV

| Переменная | Описание | Обязательная |
|---|---|---|
| `MONGO_CONNECTION_STRING` | Строка подключения к MongoDB | Да |
| `MONGO_DATABASE` | Имя базы данных MongoDB | Да |

## Формат ответа заметки

```json
{
  "id": int,
  "header": string,
  "body": string,
  "created_at": DateTime,
  "updated_at": DateTime,
  "group_id": int,
  "character_id": int
}
```

## Endpoints

### Заметки группы

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/groups/{groupId}/notes` | Список заметок | `200` |
| `POST` | `/groups/{groupId}/notes` | Создание. Body: `{ "header": string, "body": string }` | `201` |
| `GET` | `/groups/{groupId}/notes/{noteId}` | Получение | `200` / `404` |
| `PUT` | `/groups/{groupId}/notes/{noteId}` | Обновление. Body: `{ "header": string, "body": string }` | `200` / `404` |
| `DELETE` | `/groups/{groupId}/notes/{noteId}` | Удаление | `200` / `404` |

### Заметки персонажа

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/groups/{groupId}/characters/{characterId}/notes` | Список | `200` |
| `POST` | `/groups/{groupId}/characters/{characterId}/notes` | Создание. Body: `{ "header", "body" }` | `201` |
| `GET` | `/groups/{groupId}/characters/{characterId}/notes/{noteId}` | Получение | `200` / `404` |
| `PUT` | `/groups/{groupId}/characters/{characterId}/notes/{noteId}` | Обновление | `200` / `404` |
| `DELETE` | `/groups/{groupId}/characters/{characterId}/notes/{noteId}` | Удаление | `200` / `404` |
