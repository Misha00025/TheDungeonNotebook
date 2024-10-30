using Microsoft.AspNetCore.Authorization;
using TdnApi.Models.Db;
using TdnApi.Security;
using TdnApi.Configuration;
using Microsoft.AspNetCore.Authentication;

var builder = WebApplication.CreateBuilder(args);
var config = new ConfigParser("config.ini");


builder.Services.AddMvc();

builder.Services.AddDbContext<TdnDbContext>(opt => config.ConfigDbConnections(opt));
builder.Services.AddDbContext<TokensContext>(opt => config.ConfigDbConnections(opt));
builder.Services.AddSingleton<IAuthorizationHandler, AuthTypeHandler>();
builder.Services.AddSingleton<IAuthorizationHandler, AccessLevelHandler>();

var aBuilder = builder.Services.AddAuthorizationBuilder();
aBuilder.AddPolicy(Policy.AuthType.All, policy => policy.Requirements.Add(new AuthTypeRequirement(Access.All)));
aBuilder.AddPolicy(Policy.AuthType.User, policy => policy.Requirements.Add(new AuthTypeRequirement(Access.User)));
aBuilder.AddPolicy(Policy.AuthType.Group, policy => policy.Requirements.Add(new AuthTypeRequirement(Access.Group)));
aBuilder.AddPolicy(Policy.UserOrGroup, policy => policy.Requirements.Add(new AuthTypeRequirement(Access.All)));
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

app.Run();
