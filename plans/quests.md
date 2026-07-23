# Quests — План реализации

## Идея
Система квестов для группы. Квест содержит заголовок, описание, награду (текст без последствий), список целей (objectives). Может быть назначен на нескольких персонажей. Доступ к квестам фильтруется по правам пользователя на персонажа.

---

## Сущности

### SQL (только метаданные для индексации и прав доступа)

**Таблица `quest`**

| Колонка | Тип | Описание |
|---------|-----|----------|
| `quest_id` | int (PK, auto) | ID квеста |
| `group_id` | int (FK → group) | Группа-владелец |
| `uuid` | varchar(36) | UUID для связи с Mongo |

**Таблица `quest_assignment`**

| Колонка | Тип | Описание |
|---------|-----|----------|
| `quest_id` | int (FK → quest) | Квест |
| `character_id` | int (FK → character) | Персонаж |

Composite PK: (`quest_id`, `character_id`)

### Mongo `quests`

```json
{
  "_id": ObjectId,
  "uuid": "string",            // соответствует quest.uuid
  "groupId": 1,
  "header": "Найти амулет",
  "description": "...",        // rich text
  "reward": ["100 XP", "Кольцо силы"],
  "status": "active",          // active | completed | failed | cancelled
  "objectives": [
    {
      "key": "find_amulet",
      "description": "Найти амулет в храме",
      "status": "pending"       // pending | completed | failed | cancelled
    }
  ]
}
```

---

## Enum-ы

```csharp
public enum QuestStatus
{
    Active,
    Completed,
    Failed,
    Cancelled
}

public enum ObjectiveStatus
{
    Pending,
    Completed,
    Failed,
    Cancelled
}
```

---

## Модели (POCO)

```csharp
public class Quest
{
    public int Id { get; set; }
    public string Uuid { get; set; }
    public string Header { get; set; }
    public string Description { get; set; }
    public List<string> Reward { get; set; }
    public QuestStatus Status { get; set; }
    public Group Group { get; set; }
    public List<Character> AssignedCharacters { get; set; }
    public List<Objective> Objectives { get; set; }
}

public class Objective
{
    public string Key { get; set; }
    public string Description { get; set; }
    public ObjectiveStatus Status { get; set; }
}
```

---

## EF Core Entity Data

```csharp
public class QuestData : GroupEntityData
{
    public string Header { get; set; }
    public QuestStatus Status { get; set; }
}

public class QuestAssignmentData
{
    public int QuestId { get; set; }
    public int CharacterId { get; set; }
    public QuestData Quest { get; set; }
    public CharacterData Character { get; set; }
}
```

---

## MongoDB Document Model

```csharp
public class QuestMongoData : MongoEntity
{
    public string Uuid { get; set; }
    public int GroupId { get; set; }
    public string Header { get; set; }
    public string Description { get; set; }
    public List<string> Reward { get; set; }
    public string Status { get; set; }
    public List<ObjectiveMongoData> Objectives { get; set; }
}

public class ObjectiveMongoData
{
    public string Key { get; set; }
    public string Description { get; set; }
    public string Status { get; set; }
}
```

---

## QuestsProvider

```csharp
class QuestsProvider(EntityContext sql, MongoDbContext mongo, GroupAccessHelper accessHelper)
```

### Методы

- `GetQuests(int groupId, int? userId, int? characterId)` — список:
  - SQL: фильтрует `quest` по `group_id`
  - Если передан `userId`: Layer 1 — квесты, доступные пользователю (через `quest_assignment` → `user_character`)
  - Если передан `characterId`: Layer 2 — из уже отфильтрованных, только квесты конкретного персонажа
  - Если ничего не передано: все квесты группы
  - Mongo: `Find(uuid in [...])` → слияние данных
  - Возвращает `List<Quest>`

- `GetQuest(int groupId, int questId)` — один квест (без фильтрации, право проверяется на уровне прокси)
  - SQL: `Find(quest_id)`
  - Mongo: `FindOne(uuid)`
  - Возвращает `Quest?`

- `TryCreateQuest(int groupId, Quest quest)` — создание (group_admin):
  - Mongo: `InsertOne(QuestMongoData)`
  - SQL: `Add(QuestData)` с полученным uuid
  - SQL: `AddRange(QuestAssignmentData)`

- `TryUpdateQuest(int groupId, Quest quest)` — обновление (group_admin):
  - Mongo: `ReplaceOne` по uuid
  - SQL: обновить статус, header
  - SQL: перезаписать `quest_assignment` (удалить старые, вставить новые)

- `TryDeleteQuest(int groupId, int questId)` — удаление (group_admin):
  - SQL: `Remove(QuestData)` — каскадно удалит `quest_assignment`
  - Mongo: `DeleteOne` по uuid

- `TryUpdateObjectiveStatus(int groupId, int questId, string objectiveKey, ObjectiveStatus status)`:
  - Mongo: `UpdateOne` с `$set: { "objectives.$[elem].status": status }`, arrayFilter по `elem.key == objectiveKey`

---

## Controller

**`GroupQuestsController`** — наследует `GroupsBaseController`

Route: `/groups/{groupId}/quests`

| Метод | Endpoint | Права | Описание |
|-------|----------|-------|----------|
| GET | `/groups/{groupId}/quests?userId&characterId` | group_member | Список квестов с фильтрацией |
| POST | `/groups/{groupId}/quests` | group_admin | Создать квест |
| GET | `/groups/{groupId}/quests/{questId}` | group_member | Один квест |
| PUT | `/groups/{groupId}/quests/{questId}` | group_admin | Обновить квест |
| DELETE | `/groups/{groupId}/quests/{questId}` | group_admin | Удалить квест |
| PATCH | `/groups/{groupId}/quests/{questId}` | character_writer | Частичное обновление квеста (header, description, reward, status, assignedCharacters, objectives) |

---

## API Gateway (routes.yaml)

```yaml
  - path: /groups/<int:group_id>/quests
    service: campaign
    rewrite: /groups/{group_id}/quests?userId={jwt}
    policies: [group_member]

  - path: /groups/<int:group_id>/characters/<int:character_id>/quests
    service: campaign
    rewrite: /groups/{group_id}/quests?userId={jwt}&characterId={character_id}
    policies: [character_viewer]  # или group_member

  - path: /groups/<int:group_id>/quests
    method: POST
    service: campaign
    rewrite: /groups/{group_id}/quests
    policies: [group_admin]

  - path: /groups/<int:group_id>/quests/<int:quest_id>
    service: campaign
    rewrite: /groups/{group_id}/quests/{quest_id}
    policies: [group_member]

  - path: /groups/<int:group_id>/quests/<int:quest_id>
    method: PUT
    service: campaign
    rewrite: /groups/{group_id}/quests/{quest_id}
    policies: [group_admin]

  - path: /groups/<int:group_id>/quests/<int:quest_id>
    method: DELETE
    service: campaign
    rewrite: /groups/{group_id}/quests/{quest_id}
    policies: [group_admin]

  - path: /groups/<int:group_id>/quests/<int:quest_id>/objectives/<string:key>/status
    method: PUT
    service: campaign
    rewrite: /groups/{group_id}/quests/{quest_id}/objectives/{key}/status
    policies: [character_writer]
```

---

## Регистрация

### EntityBuildersConfigurer

Добавить маппинг для `QuestData` и `QuestAssignmentData`:
- `QuestData` → таблица `quest`, PK `quest_id`, FK `group_id` → `group`
- `QuestAssignmentData` → таблица `quest_assignment`, composite PK (`quest_id`, `character_id`), FK на обе таблицы

### DbContext

Добавить `DbSet<QuestData> Quests` и `DbSet<QuestAssignmentData> QuestAssignments` в `EntityContext` + вызов конфигурации в `OnModelCreating`.

### Program.cs

Зарегистрировать `QuestsProvider` как scoped.

### Constants.cs

Добавить `Quests` в `MongoCollections`.

### sql_script.sql

```sql
CREATE TABLE IF NOT EXISTS quest (
    quest_id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    uuid VARCHAR(36) NOT NULL,
    header VARCHAR(255) NOT NULL,
    status ENUM('active', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'active',
    FOREIGN KEY (group_id) REFERENCES `group`(group_id) ON DELETE CASCADE,
    UNIQUE KEY (uuid)
);

CREATE TABLE IF NOT EXISTS quest_assignment (
    quest_id INT NOT NULL,
    character_id INT NOT NULL,
    PRIMARY KEY (quest_id, character_id),
    FOREIGN KEY (quest_id) REFERENCES quest(quest_id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES character(character_id) ON DELETE CASCADE
);
```
