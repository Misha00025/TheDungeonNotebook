# C# .NET 8 Conventions

## Project Layout
```
<service>/
├── Program.cs                    # WebApplication builder
├── <service>.csproj              # net8.0, ImplicitUsings, Nullable
├── Dockerfile                    # dotnet publish multi-stage
├── appsettings.json
├── Properties/launchSettings.json
├── Source/                       # (or Sources/ for uploads-service)
│   ├── Controllers/
│   ├── Db/
│   │   ├── Contexts/
│   │   ├── Entities/
│   │   └── EntityBuildersConfigurer.cs
│   └── ...
├── tests/                        # docker-compose per service
└── README.md
```

## .csproj
```xml
<TargetFramework>net8.0</TargetFramework>
<Nullable>enable</Nullable>
<ImplicitUsings>enable</ImplicitUsings>
```

## BaseController
```csharp
public abstract class BaseController : ControllerBase
{
    protected bool IsDebug() => ...;
    public override OkObjectResult Ok(object? value);
    public override CreatedResult Created(string? uri, object? value);
    public ActionResult NotImplemented();    // 501
    public ActionResult Forbidden();         // 403
}
```

## Controllers
- Inherit from `BaseController` (not `ControllerBase`)
- Namespace: `Tdn.Api.Controllers`
- Primary constructor DI
- `[Route("plural")]`, `[ApiController]`
- Request models: `struct` nested in controller class

## EF Core
- Package: `Pomelo.EntityFrameworkCore.MySql` 8.x
- Connection string: `server=mysql;database=<db>;user=<user>;password=<pwd>`
- Entity builders via `IEntityBuildersConfigurer` singleton
- Use `Where(e => ...).FirstOrDefault()`, not `Find()`
- Entity → dict via `ToDict()` extension methods

### Migrations (EF Core)
- Schema is managed via EF Core Migrations (`Database.Migrate()`), NOT `EnsureCreated()`.
- Each service has its own `DesignTimeDbContextFactory<TContext>` in `Db/Contexts/`.
- Generate migrations from the service directory with the `MYSQL_CONNECTION_STRING` env var set:
  ```bash
  export MYSQL_CONNECTION_STRING="server=mysql;database=<db>;user=<user>;password=<pwd>"
  dotnet ef migrations add <Name>
  ```
- `Program.cs` applies migrations on startup with retry:
  ```csharp
  using (var scope = app.Services.CreateScope())
  {
      var ctx = scope.ServiceProvider.GetRequiredService<XContext>();
      for (int i = 0; i < 10; i++)
      {
          try
          {
              ctx.Database.Migrate();
              Console.WriteLine("[Init] Migrations applied successfully");
              break;
          }
          catch
          {
              Thread.Sleep(3000);
          }
      }
  }
  ```
- Migration naming convention: `InitialCreate` for first migration, descriptive names for subsequent ones.
- To generate idempotent SQL script:
  ```bash
  dotnet ef migrations script --idempotent -o migrate.sql
  ```

### DesignTimeDbContextFactory Template
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Tdn.Configuration;
using Tdn.Db.Configuers;

namespace Tdn.Db.Contexts;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<XContext>
{
    public XContext CreateDbContext(string[] args)
    {
        var config = new ConfigParser();
        var configurer = new EntityBuildersConfigurer();
        var optionsBuilder = new DbContextOptionsBuilder<XContext>();
        config.ConfigDbConnections(optionsBuilder);
        return new XContext(optionsBuilder.Options, configurer);
    }
}
```

### Campaign Service (multiple contexts)
- If a service has multiple DbContexts sharing the same database (e.g. campaign-service), designate ONE "master" context (usually `CampaignContext`) for migrations.
- The other contexts query the same tables — no separate migration needed.
- All contexts continue to be registered in DI for query use.

## Program.cs Pattern
```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddMvc();
builder.Services.AddDbContext<XContext>(config.ConfigDbConnections);
builder.Services.AddScoped<XProvider, XProvider>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();
var app = builder.Build();
app.UseHttpMetrics();
app.MapMetrics();
app.MapControllers();
app.Run();
```

### Startup DB Migration Pattern
On startup, apply pending migrations with a retry loop (waiting for MySQL readiness):

```csharp
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<XContext>();
    for (int i = 0; i < 10; i++)
    {
        try
        {
            ctx.Database.Migrate();
            Console.WriteLine("[Init] Migrations applied successfully");
            break;
        }
        catch
        {
            Thread.Sleep(3000);
        }
    }
}
```

## Prometheus Metrics
- Package: `prometheus-net.AspNetCore` 8.x
- `app.UseHttpMetrics()` + `app.MapMetrics()` in Program.cs

## Naming
- Namespace root: `Tdn.*` (e.g. `Tdn.Db.Contexts`, `Tdn.Models`)
- Controllers: plural domain name (`GroupsController`)
- Entity classes: suffix `Data` (e.g. `GroupData`, `UserData`)
- One class per file, filename matches class name
