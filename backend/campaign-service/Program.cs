using Tdn.Configuration;
using Tdn.Db.Configuers;
using Tdn.Db.Contexts;
using Tdn.Settings;
using Tdn.Db;
using Tdn.Models.Providing;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);
var config = new ConfigParser();

// General
builder.Services.AddMvc();
builder.Services.AddHttpContextAccessor();
builder.Services.AddLogging(e => e.AddConsole());

// DataBase Contexts
builder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection("MongoDbSettings"));
builder.Services.AddSingleton<IEntityBuildersConfigurer, EntityBuildersConfigurer>();
builder.Services.AddDbContext<GroupContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<EntityContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<SkillsContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<ItemsContext>(config.ConfigDbConnections);
builder.Services.AddScoped(_ => new MongoDbContext(config.GetMongoDbSettings()));

// Providers
builder.Services.AddScoped<AttributesProvider, AttributesProvider>();
builder.Services.AddScoped<SkillsProvider, SkillsProvider>();
builder.Services.AddScoped<ItemsProvider, ItemsProvider>();
builder.Services.AddScoped<SchemasProvider, SchemasProvider>();

// General
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();

var app = builder.Build();
app.UseHttpMetrics();
app.MapMetrics();
app.MapControllers();
app.Run();
