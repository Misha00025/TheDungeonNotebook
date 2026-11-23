# Campaign Service

Изменения API должны включать соответствующую адаптацию Gateway в той же работе; см. [правила вклада](CONTRIBUTING.md) и [контракт маршрутизации Gateway](docs/gateway.md).

Campaign Service is a .NET 10 ASP.NET Core service for campaigns, templates, characters, character catalog entries, assignments, character sheets, and saved Views/presentation configuration. Requests use the `X-Subject` JSON header. The [current API index](docs/README.md), including the separate [current permissions contract](docs/permissions.md), links the host contracts. The public [HTML API documentation](../../../docs/api/index.html) describes legacy routes, not this host.

The separate item and skill catalog APIs, schemas, and content contracts are documented in [`docs/catalog.md`](docs/catalog.md).

Character-attached catalog records, quantities, local values, and add receipts are documented in [`docs/character-catalog.md`](docs/character-catalog.md).

Independent item and skill group navigation and conditional membership are documented in [`docs/catalog-groups.md`](docs/catalog-groups.md).

## Structure

- `CampaignService.csproj` and `CampaignService.sln` — project and solution files
- `Source/` — host, HTTP, domain, access, configuration, and persistence code
- `Source/Persistence/Migrations/` — EF Core migration and model snapshot
- `Source/Sheets/` — template and character-sheet domain and application code
- `Source/Catalog/` — campaign-scoped item/skill catalog and typed attribute validation
- `Source/Catalog/CharacterCatalogService.cs` and `Source/Persistence/EfCharacterCatalogStore.cs` — character entries, operation receipts, and SQL row locks
- `Source/Computation/` — formula and virtual-field calculation services
- `Source/Views/` — saved view trees, declared-source projection, and presentation contexts
- `Source/Persistence/MongoContentStore.cs` — document storage for template, character, formula, view, presentation, and catalog content
- `Tests/` — unit tests
- `config/` — configuration example
- `.config/dotnet-tools.json` — local `dotnet-ef` tool manifest
- `docs/` — current host/API notes
- `Dockerfile` — container build definition

## Build and run

The service-local `global.json` selects .NET SDK `10.0.112` with `latestFeature` roll-forward. Run these commands from the service directory so the local SDK selection applies; using `--project` from repository root does not change SDK selection based on the project path.

```sh
dotnet build CampaignService.sln
dotnet test CampaignService.sln
dotnet run --project CampaignService.csproj --no-launch-profile --urls http://localhost:5100
```

From repository root, the Docker image build command is:

```sh
docker build -f apps/backend/campaign-service/Dockerfile apps/backend
```

Configuration uses standard ASP.NET Core providers. Root `appsettings.json` is followed by `appsettings.{Environment}.json`, user secrets in Development, environment variables, and command-line arguments; later providers override earlier values. Environment variable hierarchy uses `__` for hierarchical settings, for example `Database__ApplyMigrations` or `Access__MembersCanReadDefinitions`. Environment variables and command-line changes require process restart. JSON settings support reload-on-change, including logging configuration.

`CampaignApplication.Build` does not connect to MySQL. A connection string is required on host startup. Pending EF Core migrations are applied automatically when the host starts, after `Build`, using EF Core's tracked migration history.

Mongo settings are also validated on host startup. `MongoClient` is created lazily through DI and the host build does not connect to MongoDB. `Access:MembersCanReadDefinitions` controls member reads of template, formula, and View definitions and presentation context configuration; it does not grant access to another user's unassigned character sheet.

Views store a typed Layout/Widget tree and opaque native JSON parameters. The backend validates node structure and declared field sources, and can project only those sources for a specifically requested character. It does not render Views, interpret widget formats, or execute presentation/context parameters. Presentation defaults select a View by campaign and context key; they do not assign a selection to characters or templates.

## Data storage and publication boundaries

SQL stores campaign and member records, one shared-primary-key `CampaignTemplates` metadata row per campaign, separate item and skill definitions/character records/add receipts (six tables total), other resource metadata, and character assignments. MongoDB stores content in `campaignTemplates` (one document per campaign, created by the first content update), `characterSheets`, `formulaContents`, `viewContents`, `campaignPresentationConfigs`, and eight catalog collections: `itemAttributeDefinitions`, `itemContents`, `characterItemContents`, `itemGroups`, `skillAttributeDefinitions`, `skillContents`, `characterSkillContents`, and `skillGroups`. Item and skill application logic is generic/shared, but their persisted data and group/schema revisions are independent. Current point reads use MongoDB's standard unique `_id` index, whose value combines campaign ID and the internal resource key; singleton documents use `Guid.Empty` as their resource ID. The template has no public resource selector. The service does not rely on user-created indexes or full collection scans to establish publication. Mongo `contentRevision` and SQL `metadataRevision` are independent. View `params` and context parameters remain native JSON values. This service slice has no filesystem-backed content bodies.

### Destructive legacy catalog startup cleanup

**Warning: every service startup performs a destructive reset of legacy catalog data.** The awaited cleanup runs after registered database migrations (when `Database:ApplyMigrations` is enabled) and before the host serves requests. It runs even when migrations are disabled. It deletes all rows, in order, from legacy SQL tables `CatalogAdditionReceipts`, `CharacterCatalogEntries`, and `CatalogEntries`, then deletes all documents from legacy Mongo collections `catalogAttributeDefinitions`, `catalogContents`, `characterCatalogContents`, and `catalogGroups`.

This is not a data migration, backup, import, or preservation path: legacy catalog data is discarded. The cleanup does not drop the old SQL tables and does not touch the six new item/skill SQL tables, the eight new item/skill Mongo collections, or other campaign data. Migration `20261123000100_SeparateCatalogs` creates the six new tables only; older migrations remain historical, and the old tables remain empty after cleanup. New item/skill data is in distinct namespaces and persists across service restarts.

The SQL deletes run in one SQL transaction. Mongo deletes are separate operations and do not share a transaction with SQL or with one another. Missing legacy SQL tables are skipped, and deleting from an absent Mongo collection is harmless. A cleanup failure fails startup; a later startup retries the cleanup. No cleanup flag or HTTP administration endpoint is provided. This describes the configured startup behavior; it does not assert that a migration, cleanup, or service startup has been run against a real database.

Breaking migration `20261118000100_CampaignTemplate` drops the former `TemplateMetadata` table and `CharacterMetadata.TemplateId`, creates shared-primary-key `CampaignTemplates`, and seeds one empty template using the campaign name for each campaign. Old many-template SQL rows are lost; `templateContents` documents are not migrated or read. The migration cannot restore discarded old template data and downgrade is unsupported. This documents the migration behavior; no statement is made about the state of a particular database.

SQL and MongoDB do not share a transaction. Character, formula, View, and catalog-definition content is prepared in MongoDB before its SQL metadata is published; a prepared document without SQL metadata is not publicly discoverable through those resource endpoints. Character item/skill row or quantity changes and their add receipts are transactional in SQL, while local attribute content remains an independently revisioned Mongo document. The campaign template is different: its SQL metadata is created with the campaign, while its `campaignTemplates` content document is created on first edit. If publication of a character, formula, View, or character item/skill add returns an unknown outcome, check the corresponding campaign-scoped resource or receipt using the same request/resource ID before deciding what to do; do not retry with a new identifier. Unpublished content remnants are not cleaned up automatically by those publication flows; the destructive legacy cleanup above is a separate startup operation limited to the named old collections and tables.

| Setting | Purpose | Default/current value |
| --- | --- | --- |
| `MYSQL_CONNECTION_STRING` | Required MySQL connection string | No default; configure for service startup |
| `MySql:ServerVersion` | Pomelo version, parsed locally without network discovery | `8.0.36` |
| `Database:ApplyMigrations` | Apply migrations during startup | `true` |
| `MONGO_CONNECTION_STRING` | Required MongoDB connection string | No default; configure for service startup |
| `MONGO_DATABASE` | Required MongoDB database name | No default; configure for service startup |
| `Characters:DefaultImportance` | Default importance when creating a character | `background` |
| `Access:MembersCanReadDefinitions` | Allow campaign members to read template definitions | `true` |
| `urls` / `ASPNETCORE_URLS` | Listening URL configuration | Not set by the service; Kestrel uses standard defaults |
| `ASPNETCORE_ENVIRONMENT` | ASP.NET Core environment | `Production` when not set |
| `Logging:LogLevel` | Logging thresholds | Root `appsettings.json`: `Default=Warning`, `Tdn.Api=Information`, `Microsoft.AspNetCore.Hosting.Diagnostics=Information` |
| `AllowedHosts` | Host filtering | `*` from root `appsettings.json` |

Configure `MYSQL_CONNECTION_STRING`, `MONGO_CONNECTION_STRING`, and `MONGO_DATABASE` before starting. With the existing deploy compose configuration, migrations are applied automatically; set `Database__ApplyMigrations=false` to disable this behavior. The existing deploy compose configuration does not require renaming these three variables. Alternatively, from the service directory, restore the local tool and apply migrations manually:

```sh
dotnet tool restore
dotnet ef database update
```

`config/appsettings.example.json` is a reference for root appsettings, not an automatically loaded additional file. Its empty connection strings/database are placeholders, not usable credentials. Supply actual local settings through standard appsettings files, environment variables, or command-line arguments; no custom file loader is added.

There are no campaign, template, or character deletion endpoints. Delete a member's character assignments explicitly before deleting their campaign membership; restrictive foreign keys reject membership deletion while assignments remain. HTTPS can be configured through standard Kestrel settings; this service does not require certificates or add an HTTPS redirect.
