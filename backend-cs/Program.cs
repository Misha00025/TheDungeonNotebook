using Microsoft.AspNetCore.Authorization;
using Tdn.Security;
using Tdn.Configuration;
using Microsoft.AspNetCore.Authentication;
using Tdn.Db.Configuers;
using Tdn.Db.Contexts;
using Tdn.Settings;
using Tdn.Db;
using Tdn.Models.Providing;
using Tdn.Models;
using Tdn.Security.Db;

var builder = WebApplication.CreateBuilder(args);
var config = new ConfigParser("config.ini");


builder.Services.AddMvc();

builder.Services.AddHttpContextAccessor();

builder.Services.AddLogging(e => e.AddConsole());

builder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection("MongoDbSettings"));
builder.Services.AddSingleton<IEntityBuildersConfigurer, EntityBuildersConfigurer>();
builder.Services.AddDbContext<TokensContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<AccessDbContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<GroupContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<UserContext>(config.ConfigDbConnections);
builder.Services.AddScoped(_ => new MongoDbContext(config.GetMongoDbSettings()));

builder.Services.AddScoped<IModelProvider<User>, UserProvider>();
builder.Services.AddScoped<IModelProvider<Group>, GroupProvider>();


builder.Services.AddScoped<IAccessLevelProvider, AccessLevelProvider>();
builder.Services.AddScoped<IAccessContext, AccessContext>();

builder.Services.AddSingleton<IAuthorizationHandler, AuthTypeHandler>();
builder.Services.AddScoped<IAuthorizationHandler, ResourceAccessHandler>();
builder.Services.AddScoped<IAuthorizationHandler, AccessLevelHandler>();

var aBuilder = builder.Services.AddAuthorizationBuilder();

// Auth Type
aBuilder.AddPolicy(Policy.AuthType.All, policy => policy.Requirements.Add(new AuthTypeRequirement(Access.All)));
aBuilder.AddPolicy(Policy.AuthType.User, policy => policy.Requirements.Add(new AuthTypeRequirement(Access.User)));
aBuilder.AddPolicy(Policy.AuthType.Group, policy => policy.Requirements.Add(new AuthTypeRequirement(Access.Group)));
aBuilder.AddPolicy(Policy.UserOrGroup, policy => policy.Requirements.Add(new AuthTypeRequirement(Access.All)));

// Resource Access
aBuilder.AddPolicy(Policy.ResourceAccess.User, policy => policy.Requirements.Add(new ResourceRequirement(Resource.User)));
aBuilder.AddPolicy(Policy.ResourceAccess.Group, policy => policy.Requirements.Add(new ResourceRequirement(Resource.Group)));
aBuilder.AddPolicy(Policy.ResourceAccess.Character, policy => policy.Requirements.Add(new ResourceRequirement(Resource.Character)));

// Access Level
aBuilder.AddPolicy(Policy.AccessLevel.Admin, policy => policy.Requirements.Add(new AccessLevelRequirement(AccessLevel.Full)));
aBuilder.AddPolicy(Policy.AccessLevel.Moderator, policy => policy.Requirements.Add(new AccessLevelRequirement(AccessLevel.Write)));
aBuilder.AddPolicy(Policy.AccessLevel.Follower, policy => policy.Requirements.Add(new AccessLevelRequirement(AccessLevel.Read)));

builder.Services.AddAuthentication("Token")
	.AddScheme<AuthenticationSchemeOptions, TokenAuthenticationHandler>("Token", null);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();

var app = builder.Build();
app.MapControllers();
app.Run();
