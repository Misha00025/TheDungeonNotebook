using Tdn.Configuration;
using Tdn.Db.Configuers;
using Tdn.Db.Contexts;
using Tdn.Settings;
using Tdn.Db;
using Tdn.Models.Providing;
using Tdn.Models;
using Tdn.Models.Saving;

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
builder.Services.AddDbContext<UserContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<EntityContext>(config.ConfigDbConnections);
builder.Services.AddScoped(_ => new MongoDbContext(config.GetMongoDbSettings()));

// Providers
builder.Services.AddScoped<IModelProvider<User>, UserProvider>();
builder.Services.AddScoped<IModelProvider<Group>, GroupProvider>();
builder.Services.AddScoped<ItemProvider, ItemProvider>();
builder.Services.AddScoped<CharlistProvider, CharlistProvider>();
builder.Services.AddScoped<IModelProvider<Character>, CharacterProvider>();
builder.Services.AddScoped<CharacterProvider, CharacterProvider>();

// Savers
builder.Services.AddScoped<IModelSaver<Character>, CharacterSaver>();
builder.Services.AddScoped<ItemSaver, ItemSaver>();

// General
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();

var app = builder.Build();
app.MapControllers();
app.Run();
