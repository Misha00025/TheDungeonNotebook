# Campaign Service

## Общее описание

Основной бизнес-логический сервис. Управляет группами (кампаниями), персонажами, предметами, навыками, шаблонами персонажей, схемами и политиками доступа. Использует **две базы данных**: MySQL (EF Core) для реляционных данных (связи, метаданные) и MongoDB (MongoDB.Driver) для JSON-документов (контент). Не вызывает другие сервисы.

## ENV

| Переменная | Описание | Обязательная |
|---|---|---|
| `MONGO_CONNECTION_STRING` | Строка подключения к MongoDB | Да |
| `MYSQL_CONNECTION_STRING` | Строка подключения к MySQL | Да |
| `MYSQL_DATABASE` | Имя БД MySQL | Да |
| `MONGO_DATABASE` | Имя БД MongoDB | Нет (fallback = MYSQL_DATABASE) |

## Endpoints

### Группы

**Формат ответа группы:** `{ "id": int, "name": string, "icon": string }`

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/groups` | Список групп (`?userId=int`) | `200` |
| `POST` | `/groups` | Создание. Body: `{ "name", "icon"? }` | `201` |
| `GET` | `/groups/{groupId}` | Получение группы | `200` / `404` |
| `PATCH` | `/groups/{groupId}` | Обновление. Body: `{ "name"?, "icon"? }` | `200` / `400` / `404` |
| `DELETE` | `/groups/{groupId}` | Удаление | `200` / `404` |

### Персонажи

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/groups/{groupId}/characters` | Список (`?ownerId=int&userId=int`) | `200` |
| `POST` | `/groups/{groupId}/characters` | Создание. Body: `{ "name", "description", "templateId"? }`. Query: `?copyTemplate=bool` | `201` / `400` / `404` |
| `GET` | `/groups/{groupId}/characters/{characterId}` | Получение (`?witEmptyFields=bool&userId=int`) | `200` / `404` |
| `PATCH` | `/groups/{groupId}/characters/{characterId}` | Обновление. Body: `{ "name"?, "description"?, "ownerId"?, "fields"? }` | `200` / `400` / `404` |
| `DELETE` | `/groups/{groupId}/characters/{characterId}` | Удаление | `200` / `404` |

### Шаблоны персонажей

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/groups/{groupId}/characters/templates` | Список | `200` / `404` |
| `POST` | `/groups/{groupId}/characters/templates` | Создание. Body: `{ "name", "description", "fields" }` | `201` / `409` / `404` |
| `GET` | `/groups/{groupId}/characters/templates/{templateId}` | Получение | `200` / `404` |
| `PUT` | `/groups/{groupId}/characters/templates/{templateId}` | Обновление | `200` / `404` |
| `DELETE` | `/groups/{groupId}/characters/templates/{templateId}` | Удаление | `200` / `404` |

### Предметы

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/groups/{groupId}/items` | Список (`?withSecrets=bool`) | `200` / `404` |
| `POST` | `/groups/{groupId}/items` | Создание. Body: `{ "name", "description", "price"?, "attributes"?, "isSecret"?, "amount"? }` | `201` / `400` / `404` |
| `GET` | `/groups/{groupId}/items/{itemId}` | Получение | `200` / `404` |
| `PUT` | `/groups/{groupId}/items/{itemId}` | Обновление | `200` / `400` / `404` |
| `DELETE` | `/groups/{groupId}/items/{itemId}` | Удаление | `200` / `400` / `404` |

### Навыки группы

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/groups/{groupId}/skills` | Список (`?withSecrets=bool&filters=...`) | `200` / `404` |
| `GET` | `/groups/{groupId}/skills/{skillId}` | Получение | `200` / `404` |
| `POST` | `/groups/{groupId}/skills` | Создание. Body: `{ "name"?, "description"?, "attributes"?, "isSecret"? }` | `201` / `400` |
| `PUT` | `/groups/{groupId}/skills/{skillId}` | Обновление | `200` / `400` / `404` |
| `DELETE` | `/groups/{groupId}/skills/{skillId}` | Удаление | `200` / `400` |

### Атрибуты навыков

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/groups/{groupId}/skills/attributes` | Получение атрибутов | `200` / `404` |
| `PUT` | `/groups/{groupId}/skills/attributes` | Обновление. Body: `{ "attributes": [...] }` | `200` / `400` |

### Экспорт и импорт данных группы

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/groups/{groupId}/export` | Экспорт данных группы. Query: `?include=templates,characters,items,skills&userId=int` | `200` / `403` / `404` |
| `POST` | `/groups/{groupId}/import` | Импорт данных группы. Body: ExportData JSON. Query: `?include=templates,characters,items,skills&userId=int` | `200` / `400` / `403` / `404` |

**Формат ExportData:**
```json
{
  "version": 1,
  "exportedAt": "2026-07-02T01:14:06Z",
  "groupId": 1,
  "templateSchema": { "categories": [...] },
  "charlists": [{ "oldId": 0, "name": "...", "description": "...", "fields": {...} }],
  "characters": [{ "oldId": 0, "name": "...", "description": "...", "templateOldId": 0, "ownerId": null, "fields": {...} }],
  "items": [{ "oldId": 0, "name": "...", "description": "...", "price": 0, "isSecret": false, "imageLink": null, "attributes": [...] }],
  "skills": [{ "oldId": 0, "name": "...", "description": "...", "isSecret": false, "attributes": [...] }],
  "skillAttributes": { "attributes": [{ "key": "...", "name": "...", "description": "...", "isFiltered": false, "knownValues": [...] }] },
  "characterItems": [{ "characterOldId": 0, "itemOldId": 0, "amount": 1 }],
  "characterSkills": [{ "characterOldId": 0, "skillOldId": 0 }]
}
```

**Формат ImportResult:**
```json
{
  "imported": { "templates": 1, "characters": 1, "items": 1, "skills": 1 },
  "errors": [],
  "success": true
}
```

### Предметы персонажа

| Метод | URL | Ответ |
|---|---|---|
| `GET` | `/groups/{groupId}/characters/{characterId}/items` | `200` / `404` |
| `POST` | `/groups/{groupId}/characters/{characterId}/items` | `201` / `403` / `400` / `404` |
| `GET` | `/groups/{groupId}/characters/{characterId}/items/{itemId}` | `200` / `404` |
| `PUT` | `/groups/{groupId}/characters/{characterId}/items/{itemId}` | `200` / `403` / `404` |
| `DELETE` | `/groups/{groupId}/characters/{characterId}/items/{itemId}` | `200` / `404` |

### Навыки персонажа

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/groups/{groupId}/characters/{characterId}/skills` | Список (`?filters=...`) | `200` / `404` |
| `PUT` | `/groups/{groupId}/characters/{characterId}/skills/{skillId}` | Добавление/обновление | `200` / `403` / `404` / `400` |
| `DELETE` | `/groups/{groupId}/characters/{characterId}/skills/{skillId}` | Удаление | `200` / `403` / `400` |

### Политики доступа

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/polices/groups` | Список прав (`?userId=int&groupId=int`) | `200` |
| `PUT` | `/polices/groups` | Добавление/обновление. Body: `{ "UserId"?, "GroupId"?, "IsAdmin"? }` | `200` / `201` / `400` |
| `DELETE` | `/polices/groups` | Удаление (`?userId=int&groupId=int`) | `200` / `404` |
| `GET` | `/polices/groups/characters` | Права персонажа (`?groupId=int&userId=int&characterId=int`) | `200` |
| `PUT` | `/polices/groups/characters` | Добавление. Body: `{ "UserId"?, "GroupId"?, "CharacterId"?, "CanWrite"? }` | `200` / `201` / `400` / `404` |
| `DELETE` | `/polices/groups?userId=int&groupId=int&characterId=int` | Удаление прав персонажа | `200` / `404` |

### Схемы

| Метод | URL | Описание | Ответ |
|---|---|---|---|
| `GET` | `/schemas/groups/{groupId}/items` | Схема предметов | `200` / `404` |
| `PUT` | `/schemas/groups/{groupId}/items` | Обновление. Body: `{ "GroupBy": [string] }` | `200` / `403` / `400` |
| `GET` | `/schemas/groups/{groupId}/skills` | Схема навыков | `200` / `404` |
| `PUT` | `/schemas/groups/{groupId}/skills` | Обновление | `200` / `403` / `400` |
| `GET` | `/schemas/groups/{groupId}/template` | Схема шаблона персонажа | `200` / `404` |
| `PUT` | `/schemas/groups/{groupId}/template` | Обновление. Body: `{ "Categories": [...] }` | `200` / `403` / `400` |
