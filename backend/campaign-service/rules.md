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
│       │   ├── Contexts/     # 6 DbContexts
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
- `GroupContext`
- `EntityContext` (characters)
- `SkillsContext`
- `ItemsContext`
- `PolicesContext`

## MongoDbContexts (scoped, not singleton)
- `MongoDbContext` — general Mongo access
- `SchemasMongoDbContext` — schema collections

## Providers (registered as scoped in Program.cs)
- `GroupAccessHelper` — reusable group access checks
- `AttributesProvider`
- `SkillsProvider`
- `ItemsProvider`
- `GroupSchemasProvider`
- `CharacterTemplateSchemaProvider`
- `ExportImportProvider`
- `NotesProvider`

## Access Control
- `GroupAccessHelper` provides `GetAccessibleGroupIds(userId)`
- Controllers pass `userId` query param (set by gateway from JWT)
- `CheckGroupAccess(groupId, userId)` in base controllers
- `GroupsPolicesController` manages user-group membership (UserGroupData)

## Special Features
- `FormulaCalculator` in `Models/Processing/` — business logic for attribute calculations
- Export/Import via `ExportImportProvider`
- Schema system: group schemas + character template schemas (stored in MongoDB)

## Character Templates
- `TemplatesController` in `Characters/`
- `CharacterTemplateSchemaProvider` — template definitions from MongoDB
- Character creation based on templates
