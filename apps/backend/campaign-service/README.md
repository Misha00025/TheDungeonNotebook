# Campaign Service

Campaign Service is a .NET 10 ASP.NET Core service for campaigns and campaign membership. Requests use the `X-Subject` JSON header described in [the current API contract](docs/campaigns.md). The public [HTML API documentation](../../../docs/api/index.html) describes legacy routes, not this host.

## Structure

- `CampaignService.csproj` and `CampaignService.sln` — project and solution files
- `Source/` — host, HTTP, domain, access, configuration, and persistence code
- `Source/Persistence/Migrations/` — EF Core migration and model snapshot
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

Database configuration uses standard ASP.NET Core providers. Root `appsettings.json` is followed by `appsettings.{Environment}.json`, user secrets in Development, environment variables, and command-line arguments; later providers override earlier values. Environment variable hierarchy uses `__`, for example `ConnectionStrings__MySql`. Environment variables and command-line changes require process restart. JSON settings support reload-on-change, including logging configuration.

`CampaignApplication.Build` does not connect to MySQL. A connection string is required on host startup. Migrations run only when explicitly enabled.

| Setting | Purpose | Default/current value |
| --- | --- | --- |
| `ConnectionStrings:MySql` | Required MySQL connection string | No default; configure for service startup |
| `MySql:ServerVersion` | Pomelo version, parsed locally without network discovery | `8.0.36` |
| `Database:ApplyMigrations` | Apply migrations during startup | `false` |
| `urls` / `ASPNETCORE_URLS` | Listening URL configuration | Not set by the service; Kestrel uses standard defaults |
| `ASPNETCORE_ENVIRONMENT` | ASP.NET Core environment | `Production` when not set |
| `Logging:LogLevel` | Logging thresholds | Root `appsettings.json`: `Default=Warning`, `Tdn.Api=Information`, `Microsoft.AspNetCore.Hosting.Diagnostics=Information` |
| `AllowedHosts` | Host filtering | `*` from root `appsettings.json` |

Configure `ConnectionStrings:MySql` and optionally `Database__ApplyMigrations=true` before starting. Alternatively, from the service directory, restore the local tool and apply migrations:

```sh
dotnet tool restore
dotnet ef database update
```

`config/appsettings.example.json` is a reference for root appsettings, not an automatically loaded additional file. Its empty connection string is a placeholder. Supply actual local settings through standard appsettings files, environment variables, or command-line arguments; no custom file loader is added.

There is no campaign deletion endpoint. Subsequent requests resolve current membership from SQL. HTTPS can be configured through standard Kestrel settings; this service does not require certificates or add an HTTPS redirect.
