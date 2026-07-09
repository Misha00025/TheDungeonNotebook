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

## Prometheus Metrics
- Package: `prometheus-net.AspNetCore` 8.x
- `app.UseHttpMetrics()` + `app.MapMetrics()` in Program.cs

## Naming
- Namespace root: `Tdn.*` (e.g. `Tdn.Db.Contexts`, `Tdn.Models`)
- Controllers: plural domain name (`GroupsController`)
- Entity classes: suffix `Data` (e.g. `GroupData`, `UserData`)
- One class per file, filename matches class name
