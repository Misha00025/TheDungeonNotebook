# Dashboard Config — Техническое задание (backend)

## Исходная постановка

Держать деньги в инвентаре неудобно — их изменение происходит чаще, чем у других сущностей. Делать их частью листа персонажа (character fields) тоже неудобно — поля предназначены для статических/расчётных характеристик. Требуется механизм, который позволяет:

1. Мастеру задать **базовый набор полей-ресурсов** для всей группы (например, HP, мана, золото)
2. Игроку — **самостоятельно** добавлять себе дополнительные ресурсы и закреплять предметы на дашборде
3. Экипировка — **общая для персонажа** (видят все, кто смотрит персонажа)
4. Каждому пользователю видеть **свои пины способностей и порядок** (независимо от других)
5. Видеть ресурсы "снаружи" — на карточке персонажа в списке
6. Быстро изменять значения ресурсов (клик, +1/-1)

## Где что хранится

| Данные | Сервер | localStorage |
|--------|:------:|:------------:|
| GM: базовые `fields` группы | ✅ Schema MongoDB, коллекция `schemas`, тип `"characters"` | — |
| Персонаж: `equipment` (экипировка, itemId) | ✅ Основная MongoDB, `CharacterMongoData.EquipmentConfig` | — |
| Персонаж: `additionalFields` | — | ✅ |
| Персонаж: `items` (ресурсные предметы на дашборде) | — | ✅ |
| Персонаж: `pinnedSkills` (закреплённые скиллы) | — | ✅ |
| Порядок/сортировка элементов | — | ✅ |

**Принцип слияния на фронте:**
- эффективный `fields` = `group.baseFields ∪ userData.additionalFields` (из localStorage)
- `equipment` загружается с сервера при старте
- всё остальное — из localStorage

## Backend (campaign-service C#)

### 1. Schema ресурсов персонажей (групповой уровень)

По аналогии с существующими схемами (`items`, `skills`, `template`) — новая схема типа `"characters"` в Schema MongoDB (коллекция `schemas`).

#### Модели

Новый файл `Source/Models/Schemas/Characters/CharacterResourcesSchemaModels.cs`:

```csharp
namespace Tdn.Models.Schemas.Characters;

public struct CharacterResourcesPostData
{
    public List<string> Fields { get; set; }
}

public class CharacterResourcesSchema
{
    public string Type = "characters";
    public List<string> Fields = new();
}

public class CharacterResourcesMongoData : GroupSchemaMongoData
{
    [BsonElement("fields")]
    public List<string> Fields = new();
}
```

#### Conversions

Новый файл `Source/Models/Schemas/Characters/CharacterResourcesConversions.cs`:

```csharp
namespace Tdn.Models.Schemas.Characters.Conversion;

public static class CharacterResourcesConversion
{
    public static CharacterResourcesSchema AsModel(this CharacterResourcesPostData data)
    {
        return new CharacterResourcesSchema { Fields = data.Fields };
    }

    public static object ToResponse(this CharacterResourcesSchema schema) => new
    {
        type = schema.Type,
        fields = schema.Fields
    };
}
```

#### Provider

Новый файл `Source/Models/Schemas/Characters/CharacterResourcesSchemaProvider.cs`:

```csharp
namespace Tdn.Models.Schemas.Characters;

public class CharacterResourcesSchemaProvider
{
    private const string COLLECTION_NAME = "schemas";
    private const string TYPE = "characters";

    public SchemasMongoDbContext _dbContext;

    public CharacterResourcesSchemaProvider(SchemasMongoDbContext context)
    {
        _dbContext = context;
    }

    private CharacterResourcesMongoData AsData(int groupId, CharacterResourcesSchema schema) => new()
    {
        GroupId = groupId,
        Type = TYPE,
        Fields = schema.Fields
    };

    public CharacterResourcesMongoData? GetSchema(int groupId)
    {
        var filter = Builders<CharacterResourcesMongoData>.Filter;
        var query = filter.And(
            filter.Eq(e => e.GroupId, groupId),
            filter.Eq(e => e.Type, TYPE)
        );
        return _dbContext.GetCollection<CharacterResourcesMongoData>(COLLECTION_NAME).Find(query).FirstOrDefault();
    }

    public bool TrySaveSchema(int groupId, CharacterResourcesSchema schema)
    {
        var filter = Builders<CharacterResourcesMongoData>.Filter;
        var query = filter.And(
            filter.Eq(e => e.GroupId, groupId),
            filter.Eq(e => e.Type, TYPE)
        );
        var oldData = _dbContext.GetCollection<CharacterResourcesMongoData>(COLLECTION_NAME).Find(query).FirstOrDefault();
        var newData = AsData(groupId, schema);
        if (oldData == null)
        {
            _dbContext.GetCollection<CharacterResourcesMongoData>(COLLECTION_NAME).InsertOne(newData);
            return true;
        }
        else
        {
            newData.Id = oldData.Id;
            var result = _dbContext.GetCollection<CharacterResourcesMongoData>(COLLECTION_NAME)
                .ReplaceOne(query, newData, new ReplaceOptions { IsUpsert = true });
            return result.ModifiedCount > 0;
        }
    }
}
```

#### Контроллер

Новый файл `Source/Controllers/Schemas/CharacterResourcesSchemaController.cs`:

```csharp
[ApiController]
[Route("schemas/groups/{groupId}/characters/resources")]
public class CharacterResourcesSchemaController : BaseController
{
    private CharacterResourcesSchemaProvider _provider;
    private GroupAccessHelper _accessHelper;

    public CharacterResourcesSchemaController(
        CharacterResourcesSchemaProvider provider,
        GroupAccessHelper accessHelper)
    {
        _provider = provider;
        _accessHelper = accessHelper;
    }

    [HttpGet]
    public ActionResult GetSchema(int groupId, [FromQuery] int? userId = null)
    {
        if (userId != null && !_accessHelper.HasGroupAccess(groupId, userId.Value))
            return NotFound();
        var schema = _provider.GetSchema(groupId);
        if (schema != null)
            return Ok(new { type = "characters", fields = schema.Fields });
        return Ok(new { type = "characters", fields = new List<string>() });
    }

    [HttpPut]
    public ActionResult PutSchema(int groupId, CharacterResourcesPostData data, [FromQuery] int? userId = null)
    {
        if (userId != null && !_accessHelper.IsAdmin(groupId, userId.Value))
            return Forbidden();
        var schema = data.AsModel();
        var ok = _provider.TrySaveSchema(groupId, schema);
        return ok ? Ok(schema.ToResponse()) : BadRequest();
    }
}
```

**Response GET:**
```json
{
  "type": "characters",
  "fields": ["hp", "gold"]
}
```

---

### 2. Equipment персонажа (per-character)

#### MongoDB: CharacterMongoData.EquipmentConfig

В существующий `CharacterMongoData` в `GroupEntityMongoData.cs` добавить:

```csharp
[BsonElement("equipment")]
[BsonIgnoreIfNull]
public EquipmentConfig? Equipment;
```

Новый класс там же:

```csharp
public class EquipmentConfig
{
    [BsonElement("items")]
    public List<int> Items = new();
}
```

#### Provider

Добавить в существующий `Source/Models/Providing/Items/ItemsProvider.cs` или в новый файл `Source/Models/Providing/Characters/CharacterResourcesProvider.cs`:

```csharp
namespace Tdn.Models.Providing;

public class CharacterEquipmentProvider
{
    private readonly EntityContext _context;
    private readonly MongoDbContext _mongo;
    private readonly GroupAccessHelper _accessHelper;

    public CharacterEquipmentProvider(
        EntityContext context,
        MongoDbContext mongo,
        GroupAccessHelper accessHelper)
    {
        _context = context;
        _mongo = mongo;
        _accessHelper = accessHelper;
    }

    public List<int> GetEquipment(int groupId, int characterId)
    {
        // загрузить CharacterMongoData, вернуть Equipment?.Items ?? new()
    }

    public bool TryAddEquipment(int groupId, int characterId, int itemId)
    {
        // $addToSet по полю "equipment.items"
    }

    public bool TryRemoveEquipment(int groupId, int characterId, int itemId)
    {
        // $pull по полю "equipment.items"
    }

    public bool TrySaveEquipment(int groupId, int characterId, List<int> ids)
    {
        // полная замена "equipment.items"
    }
}
```

#### API эндпоинты

| Метод | Путь | Тело | Доступ | Эффект |
|-------|------|------|--------|--------|
| `GET` | `/groups/{gid}/characters/{cid}/equipment` | — | Есть доступ к персонажу | Получить массив itemId |
| `PATCH` | `/groups/{gid}/characters/{cid}/equipment` | `{ "action": "add", "itemId": 3 }` | CanWriteCharacter | `$addToSet` |
| `PATCH` | `/groups/{gid}/characters/{cid}/equipment` | `{ "action": "remove", "itemId": 3 }` | CanWriteCharacter | `$pull` |
| `PUT` | `/groups/{gid}/characters/{cid}/equipment` | `{ "itemIds": [7, 3, 5] }` | CanWriteCharacter | Полная перезапись |

Ответ на PATCH/PUT — обновлённый массив `items`.

#### Контроллер

Новый файл `Source/Controllers/Characters/CharacterEquipmentController.cs`:

```csharp
[ApiController]
[Route("groups/{groupId}/characters/{characterId}/equipment")]
public class CharacterEquipmentController : CharactersBaseController
{
    private CharacterEquipmentProvider _provider;

    public CharacterEquipmentController(
        EntityContext context, MongoDbContext mongo,
        GroupContext groupContext, GroupAccessHelper accessHelper,
        CharacterEquipmentProvider provider)
        : base(context, mongo, groupContext, accessHelper)
    {
        _provider = provider;
    }

    // GET, PATCH (add/remove), PUT
}
```

### 3. Регистрация в DI

В `Program.cs` добавить:

```csharp
builder.Services.AddScoped<CharacterResourcesSchemaProvider, CharacterResourcesSchemaProvider>();
builder.Services.AddScoped<CharacterEquipmentProvider, CharacterEquipmentProvider>();
```

Контроллеры подхватятся автоматически через `AddControllers()`.
