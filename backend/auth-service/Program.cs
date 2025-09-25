using Tdn.Configuration;
using Tdn.Db.Configuers;
using Tdn.Db.Contexts;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);
var config = new ConfigParser();

// General
builder.Services.AddMvc();
builder.Services.AddHttpContextAccessor();
builder.Services.AddLogging(e => e.AddConsole());

builder.Services.AddSingleton<IEntityBuildersConfigurer, EntityBuildersConfigurer>();
builder.Services.AddSingleton<Configs, Configs>((_) => config.GetConfigs());
builder.Services.AddDbContext<LoginContext>(config.ConfigDbConnections);

// General
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();
var app = builder.Build();
app.UseHttpMetrics();
app.MapMetrics();
app.MapControllers();
app.Run();