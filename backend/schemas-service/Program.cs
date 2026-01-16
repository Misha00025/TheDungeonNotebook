using Tdn.Configuration;
using Tdn.Settings;
using Tdn.Db;
using Prometheus;
using Tdn.Models.Groups.Items;
using Tdn.Models.Groups.Templates;

var builder = WebApplication.CreateBuilder(args);
var config = new ConfigParser();

// General
builder.Services.AddMvc();
builder.Services.AddHttpContextAccessor();
builder.Services.AddLogging(e => e.AddConsole());

// DataBase Contexts
builder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection("MongoDbSettings"));
builder.Services.AddScoped(_ => new MongoDbContext(config.GetMongoDbSettings()));

// Providers
builder.Services.AddScoped<GroupSchemasProvider, GroupSchemasProvider>();
builder.Services.AddScoped<CharacterTemplateSchemaProvider, CharacterTemplateSchemaProvider>();

// General
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();

var app = builder.Build();
app.UseHttpMetrics();
app.MapMetrics();
app.MapControllers();
app.Run();
