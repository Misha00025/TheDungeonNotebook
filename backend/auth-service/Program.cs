using StackExchange.Redis;
using Tdn.Configuration;
using Tdn.Db.Configuers;
using Tdn.Db.Contexts;
using Tdn.Services;
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
builder.Services.AddSingleton<OidcConfig>();
builder.Services.AddSingleton<ClientStore>();
builder.Services.AddDbContext<LoginContext>(config.ConfigDbConnections);

// General
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();
var app = builder.Build();
app.UseHttpMetrics();
app.MapMetrics();
app.UseMiddleware<Tdn.Api.Middleware.InternalPortProtectionMiddleware>();
app.MapControllers();
app.Run();