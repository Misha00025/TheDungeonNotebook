using Microsoft.EntityFrameworkCore;
using Tdn.Configuration;
using Tdn.Db.Configurers;
using Tdn.Db.Contexts;
using Tdn.Settings;
using Tdn.Db;
using Tdn.Models.Providing;
using Tdn.Models.Schemas;
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
builder.Services.AddDbContext<CampaignContext>(config.ConfigDbConnections);
builder.Services.AddScoped<IMongoDbContext>(_ => new MongoDbContext(config.GetMongoDbSettings()));
builder.Services.AddScoped<ISchemasMongoDbContext>(_ => new SchemasMongoDbContext(config.GetSchemasMongoDbSettings()));

// Providers
builder.Services.AddScoped<GroupAccessHelper, GroupAccessHelper>();
builder.Services.AddScoped<GroupPolicesProvider, GroupPolicesProvider>();
builder.Services.AddScoped<AttributesProvider, AttributesProvider>();
builder.Services.AddScoped<SkillsProvider, SkillsProvider>();
builder.Services.AddScoped<ItemsProvider, ItemsProvider>();
builder.Services.AddScoped(sp => new GenericMongoProvider<SkillsSchemaMongoData>(
    sp.GetRequiredService<ISchemasMongoDbContext>(), "schemas", "skills"));
builder.Services.AddScoped(sp => new GenericMongoProvider<ItemsSchemaMongoData>(
    sp.GetRequiredService<ISchemasMongoDbContext>(), "schemas", "items"));
builder.Services.AddScoped(sp => new GenericMongoProvider<TemplateSchemaMongoData>(
    sp.GetRequiredService<ISchemasMongoDbContext>(), "templates", "template"));
builder.Services.AddScoped<ExportImportProvider, ExportImportProvider>();
builder.Services.AddScoped<NotesProvider, NotesProvider>();
builder.Services.AddScoped(sp => new GenericMongoProvider<CharacterResourcesMongoData>(
    sp.GetRequiredService<ISchemasMongoDbContext>(), "schemas", "characters"));
builder.Services.AddScoped<CharacterEquipmentProvider, CharacterEquipmentProvider>();
builder.Services.AddScoped<CharacterLogProvider, CharacterLogProvider>();
builder.Services.AddScoped<CharactersProvider, CharactersProvider>();
builder.Services.AddScoped<GroupProvider, GroupProvider>();
builder.Services.AddScoped<QuestsProvider, QuestsProvider>();

// General
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();

var app = builder.Build();

// Apply pending migrations with retry (wait for MySQL to be ready)
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<CampaignContext>();
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
app.MapControllers();
app.Run();
