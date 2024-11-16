using Microsoft.AspNetCore.Authorization;
using TdnApi.Models.Db;
using TdnApi.Security;
using TdnApi.Configuration;
using Microsoft.AspNetCore.Authentication;
using TdnApi.Db.Configuers;
using TdnApi.Db.Contexts;
using TdnApi.Parsing.Http;
using TdnApi.Providers;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
var config = new ConfigParser("config.ini");


builder.Services.AddMvc();

builder.Services.AddHttpContextAccessor();

builder.Services.AddSingleton<IEntityBuildersConfigurer, EntityBuildersConfigurer>();
builder.Services.AddDbContext<AppDbContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<TokensContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<AccessDbContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<GroupContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<UserContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<CharacterContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<InventoryContext>(config.ConfigDbConnections);
builder.Services.AddDbContext<NoteContext>(config.ConfigDbConnections);

builder.Services.AddScoped<IAccessLevelProvider, AccessLevelProvider>();
builder.Services.AddScoped<IHttpInfoContainer, HttpInfoContainer>();

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
builder.Services.AddOpenApiDocument((config) =>
{
	config.DocumentName = "TdnApi";
	config.Title = "TdnApi v2";
	config.Version = "v2";
});

builder.Services.AddControllers();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
	app.UseOpenApi();
	app.UseSwaggerUi(config =>
	{
		config.DocumentTitle = "TodoAPI";
		config.Path = "/swagger";
		config.DocumentPath = "/swagger/{documentName}/swagger.json";
		config.DocExpansion = "list";
	});
}

app.MapControllers();

using (var scope = app.Services.CreateScope())
{
	var serviceProvider = scope.ServiceProvider;

	try
	{
		serviceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
	}
	catch (Exception ex)
	{
		// Логируем ошибку
		var logger = serviceProvider.GetRequiredService<ILogger<Program>>();
		logger.LogInformation(ex, "An error occurred while migrating the database.");
	}
}

app.Run();
