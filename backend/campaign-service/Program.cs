using Tdn.Configuration;
using Tdn.Db.Configuers;
using Tdn.Db.Contexts;
using Tdn.Settings;
using Tdn.Db;
using Tdn.Models.Providing;
using Tdn.Models.Schemas.Items;
using Tdn.Models.Schemas.Templates;
using Tdn.Models.Schemas.Characters;
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
builder.Services.AddDbContext<PolicesContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<CampaignContext>(config.ConfigDbConnections);
builder.Services.AddScoped(_ => new MongoDbContext(config.GetMongoDbSettings()));
builder.Services.AddScoped(_ => new SchemasMongoDbContext(config.GetSchemasMongoDbSettings()));

// Providers
builder.Services.AddScoped<GroupAccessHelper, GroupAccessHelper>();
builder.Services.AddScoped<AttributesProvider, AttributesProvider>();
builder.Services.AddScoped<SkillsProvider, SkillsProvider>();
builder.Services.AddScoped<ItemsProvider, ItemsProvider>();
builder.Services.AddScoped<GroupSchemasProvider, GroupSchemasProvider>();
builder.Services.AddScoped<CharacterTemplateSchemaProvider, CharacterTemplateSchemaProvider>();
builder.Services.AddScoped<ExportImportProvider, ExportImportProvider>();
builder.Services.AddScoped<NotesProvider, NotesProvider>();
builder.Services.AddScoped<CharacterResourcesSchemaProvider, CharacterResourcesSchemaProvider>();
builder.Services.AddScoped<CharacterEquipmentProvider, CharacterEquipmentProvider>();
builder.Services.AddScoped<CharacterLogProvider, CharacterLogProvider>();
builder.Services.AddScoped<QuestsProvider, QuestsProvider>();

// General
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();

var app = builder.Build();

// Auto-create tables with retry (wait for MySQL to be ready)
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<CampaignContext>();
    for (int i = 0; i < 10; i++)
    {
        try
        {
            ctx.Database.EnsureCreated();
            Console.WriteLine("[Init] Tables created/verified successfully");
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
app.MapControllers();
app.Run();
