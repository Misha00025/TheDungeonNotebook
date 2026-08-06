# campaign-service Rules

## Responsibility
Core business logic: groups, characters, items, skills, notes, schemas, export/import, access policies.

## Project Structure
```
campaign-service/
├── Source/
│   ├── Constants.cs, Settings.cs, ConfigParser.cs
│   ├── Controllers/
│   │   ├── BaseController.cs, Paths.cs
│   │   ├── Groups/           (GroupsController, GroupsBaseController)
│   │   │   ├── Items/        (GroupItemsController)
│   │   │   └── Skills/       (GroupSkillsController, GroupAttributesController)
│   │   ├── Characters/       (CharactersController, CharactersBaseController)
│   │   │   ├── Items/        (CharacterItemsController)
│   │   │   └── Skills/       (CharacterSkillsController, TemplatesController)
│   │   ├── Notes/            (GroupNotesController, CharacterNotesController)
│   │   ├── Polices/          (GroupsPolicesController)
│   │   └── Schemas/          (GroupSchemasController, CharacterTemplateSchemaController)
│   └── Models/
│       ├── Entities/         # Group.cs, Item.cs, Skill.cs (POCO)
│       ├── Db/
│       │   ├── Contexts/     # 1 SQL (CampaignContext) + 2 Mongo (MongoDbContext, SchemasMongoDbContext)
│       │   ├── Entities/     # EF entities
│       │   └── EntityBuildersConfigurer.cs
│       ├── Providing/        # All providers
│       ├── Schemas/          # Items, Templates, Skills schemas
│       ├── Conversions/      # DTO, ToDict, ToResponse
│       └── Processing/       # FormulaCalculator
└── Program.cs
```

## Databases
- **MySQL** via EF Core (Pomelo): groups, characters, items, skills, notes, policies
- **MongoDB** via MongoDB.Driver 3.x: schemas (group schemas, character template schemas)
- Mongo settings from `appsettings.json` → `MongoDbSettings` section

## DbContexts (MySQL)
- `CampaignContext` — единственный SQL-контекст (MySQL), объединяет все сущности: группы, персонажи, предметы, навыки, заметки, квесты, политики, шаблоны

## MongoDbContexts (scoped, not singleton)
- `MongoDbContext` — общий Mongo-доступ (контент: заметки, квесты и др.)
- `SchemasMongoDbContext` — коллекции схем (групповые схемы, схемы шаблонов персонажей)

## Providers (registered as scoped in Program.cs)
- `GroupAccessHelper` — низкоуровневые проверки доступа к группам/персонажам через `CampaignContext`
- `SubjectAccessHelper` — высокоуровневый хелпер проверок доступа (`HasGroupAccess`, `IsAdmin`, `HasCharacterAccess`, `CanWriteCharacter`), делегирует `GroupAccessHelper`
- `AttributesProvider`
- `SkillsProvider`
- `ItemsProvider`
- `GroupSchemasProvider`
- `CharacterTemplateSchemaProvider`
- `ExportImportProvider`
- `NotesProvider`

## Access Control
- `CampaignAccessMiddleware` (Source/Middleware/) — авторизация в самом сервисе, проверяет права по path+method на уровнях Member / Admin / CharacterWrite
- Middleware опирается на `SubjectAccessHelper` (IsAdmin, CanWriteCharacter, HasGroupAccess, HasCharacterAccess) и `GroupAccessHelper`
- Gateway выполняет только аутентификацию (`auth: required`) и передаёт `X-Subject`; gateway access-хендлеры (group_admin, character_writer и т.п.) для campaign не используются
- `GroupsPolicesController` manages user-group membership (UserGroupData)

## Special Features
- `FormulaCalculator` in `Models/Processing/` — business logic for attribute calculations
- Export/Import via `ExportImportProvider`
- Schema system: group schemas + character template schemas (stored in MongoDB)

## Character Templates
- `TemplatesController` in `Characters/`
- `CharacterTemplateSchemaProvider` — template definitions from MongoDB
- Character creation based on templates
