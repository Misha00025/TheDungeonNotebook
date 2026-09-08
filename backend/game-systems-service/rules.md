# game-systems-service Rules

## Responsibility
Game systems, versions, snapshots and content (items, skills, character template). Content is stored in a snapshot (MongoDB); replacing a collection = create/update/delete of elements.

## Project Structure
```
game-systems-service/
├── Program.cs
├── game-systems-service.csproj     # net8.0, references Tdn.Shared
├── Dockerfile                      # dotnet publish multi-stage (context: ./backend)
├── init-game-systems.sh            # creates GAME_SYSTEMS_DATABASE in MySQL
├── appsettings.json
├── Properties/
├── Source/
│   ├── Controllers/
│   │   ├── BaseController.cs
│   │   ├── SystemsController.cs        # /systems CRUD
│   │   ├── SystemVersionsController.cs # /systems/{id}/versions, snapshot
│   │   └── SystemContentController.cs  # /systems/{id}/versions/{vid}/content (items/skills/character_template)
│   ├── Db/
│   │   ├── Contexts/               # GameSystemsContext (MySQL), MongoDbContext, DesignTimeDbContextFactory
│   │   └── Entities/               # SystemData, SystemVersionData, SnapshotData, SnapshotContent*, ...
│   └── Models/
│       ├── Access/
│       ├── Conversions/
│       ├── DTOs/
│       └── Providing/
└── Migrations/
```

## Controllers
- Inherit from `BaseController`
- Namespace: `Tdn.Api.Controllers`
- `[Route("systems")]`, `[ApiController]`
- Systems: GET/POST `/systems`, GET/PATCH/DELETE `/systems/{systemId}`
- Versions: GET/POST `/systems/{systemId}/versions`, GET `/systems/{systemId}/versions/{versionId}`, GET `.../snapshot`
- Content: GET `/systems/{systemId}/versions/{versionId}/content`, PUT `.../content/items`, PUT `.../content/skills`, PUT `.../content/character_template`

## Databases
- MySQL: `GAME_SYSTEMS_DATABASE` (systems, versions)
- MongoDB: snapshots (content)

## Shared Library
- Uses `Tdn.Shared` for common DTOs (`GameSystem`, `SystemVersion`, `SnapshotRef`, `ContentItem`).
