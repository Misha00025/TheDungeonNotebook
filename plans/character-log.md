# Character Action Log — План реализации

## Идея
Журнал действий над персонажем: изменение полей, предметов, навыков, экипировки. Хранится в MongoDB — один документ на персонажа в коллекции `character_logs`.

---

## Коллекция `character_logs`

### Документ
```csharp
public class CharacterLogDocument
{
    public ObjectId Id;
    public int CharacterId;
    public int GroupId;
    public List<CharacterLogEntry> Entries = new();
}
```

### Запись лога
```csharp
public struct CharacterLogEntry
{
    public DateTime Timestamp;
    public int ActorId;
    public string ActionType;  // "field_change" | "item_change" | "skill_change" | "equipment_change"
    public LogDetails Details;
}

public struct LogDetails
{
    public string Key;   // field_key или item_id / skill_id (строкой)
    public int OldValue;
    public int Delta;
}
```

Индекс: `{ character_id: 1 }`

### Пример документа
```json
{
  "_id": ObjectId("..."),
  "character_id": 123,
  "group_id": 456,
  "entries": [
    { "timestamp": "2026-07-22T12:00:00Z", "actor_id": 42, "action_type": "field_change", "details": { "key": "hp", "old_value": 20, "delta": -5 } },
    { "timestamp": "2026-07-22T13:00:00Z", "actor_id": 42, "action_type": "item_change", "details": { "key": "17", "old_value": 2, "delta": 1 } },
    { "timestamp": "2026-07-22T14:00:00Z", "actor_id": 7, "action_type": "skill_change", "details": { "key": "5", "old_value": 0, "delta": 1 } },
    { "timestamp": "2026-07-22T15:00:00Z", "actor_id": 7, "action_type": "equipment_change", "details": { "key": "12", "old_value": 0, "delta": 1 } }
  ]
}
```

---

## CharacterLogProvider (scoped)

```csharp
class CharacterLogProvider(MongoDbContext mongo)
```

Методы:
- `LogFieldChange(int characterId, int groupId, int actorId, string fieldKey, int oldValue, int delta)`
- `LogItemChange(int characterId, int groupId, int actorId, int itemId, int oldValue, int delta)`
- `LogSkillChange(int characterId, int groupId, int actorId, int skillId, int oldValue, int delta)`
- `LogEquipmentChange(int characterId, int groupId, int actorId, int itemId, int oldValue, int delta)`
- `GetLog(int characterId, int limit, int offset) -> (List<CharacterLogEntry> entries, int total)`

Внутренний метод:
- `PushLogEntry(int characterId, int groupId, CharacterLogEntry entry)` — `UpdateOne` с `$push` + `$setOnInsert` (upsert)

---

## Внедрение в контроллеры

Перед каждым логом нужно прочитать `old_value` до изменения и вычислить `delta = new_value - old_value`.

| Контроллер | Метод | ActionType | Что логировать |
|---|---|---|---|
| `CharactersController` | `PatchCharacter` | `field_change` | Каждое изменённое поле |
| `CharacterItemsController` | `PostItem` | `item_change` | `old_value: 0`, `delta: +amount` |
| `CharacterItemsController` | `PutItem` | `item_change` | `old_value` из БД, `delta = new_amount - old_amount` |
| `CharacterItemsController` | `DeleteItem` | `item_change` | `old_value` — текущее количество, `delta = -old_value` |
| `CharacterSkillsController` | `PutSkill` | `skill_change` | `old_value: 0`, `delta: 1` |
| `CharacterSkillsController` | `DeleteSkill` | `skill_change` | `old_value: 1`, `delta: -1` |
| `CharacterEquipmentController` | `PatchEquipment(add)` | `equipment_change` | `old_value: 0`, `delta: 1` |
| `CharacterEquipmentController` | `PatchEquipment(remove)` | `equipment_change` | `old_value: 1`, `delta: -1` |
| `CharacterEquipmentController` | `PutEquipment` | `equipment_change` | Пропустить (замена всего списка — сложно считать diff) |

---

## Endpoint

```
GET groups/{groupId}/characters/{characterId}/log?limit=50&offset=0
```

Ответ:
```json
{
  "entries": [
    {
      "timestamp": "2026-07-22T12:00:00Z",
      "actor_id": 42,
      "action_type": "field_change",
      "details": {
        "key": "hp",
        "old_value": 20,
        "delta": -5
      }
    }
  ],
  "total": 1
}
```

---

## Дополнительно

- Добавить `userId` на write-endpoints где его нет (проверка `CanWriteCharacter` уже есть в большинстве)
- Зарегистрировать `CharacterLogProvider` в DI (`Program.cs`)
- Добавить коллекцию `character_logs` в `Constants.cs`
