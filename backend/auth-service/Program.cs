using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using Tdn.Configuration;
using Tdn.Db.Configuers;
using Tdn.Db.Contexts;
// using Tdn.Services;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);
var config = new ConfigParser();

// General
builder.Services.AddMvc();
builder.Services.AddHttpContextAccessor();
builder.Services.AddLogging(e => e.AddConsole());

var redisConnectionString = Environment.GetEnvironmentVariable("REDIS_CONNECTION_STRING")
    ?? throw new InvalidOperationException("REDIS_CONNECTION_STRING is missing");
var redis = ConnectionMultiplexer.Connect(redisConnectionString);
builder.Services.AddSingleton<IConnectionMultiplexer>(redis);

// General
builder.Services.AddMvc();
builder.Services.AddHttpContextAccessor();

builder.Services.AddSingleton<IEntityBuildersConfigurer, EntityBuildersConfigurer>();
builder.Services.AddSingleton<Configs, Configs>((_) => config.GetConfigs());
builder.Services.AddSingleton<IssuerConfig>();
builder.Services.AddDbContext<LoginContext>(config.ConfigDbConnections);

// General
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();
var app = builder.Build();

// Apply pending migrations with retry (wait for MySQL to be ready)
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<LoginContext>();
    for (int i = 0; i < 10; i++)
    {
        try
        {
            ctx.Database.Migrate();
            Console.WriteLine("[Init] Migrations applied successfully");
            break;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Init] MySQL not ready (attempt {i+1}/10): {ex.Message}");
            if (i == 9) throw;
            Thread.Sleep(3000);
        }
    }
}

app.UseHttpMetrics();
app.MapMetrics();
app.UseMiddleware<Tdn.Api.Middleware.InternalPortProtectionMiddleware>();
app.MapControllers();
app.Run();