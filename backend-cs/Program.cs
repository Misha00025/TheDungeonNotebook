using Microsoft.AspNetCore.Authorization;
using TdnApi.Models.Db;
using TdnApi.Security;
using TdnApi.Configuration;
using Microsoft.AspNetCore.Authentication;

var builder = WebApplication.CreateBuilder(args);
var config = new ConfigParser("config.ini");


builder.Services.AddMvc();

builder.Services.AddDbContext<UserGroupContext>(opt => config.ConfigDbConnections(opt));
builder.Services.AddDbContext<TokensContext>(opt => config.ConfigDbConnections(opt));
builder.Services.AddSingleton<IAuthorizationHandler, TokenHandler>();

builder.Services.AddAuthorizationBuilder()
	.AddPolicy(Policy.All, policy => policy.Requirements.Add(new TokenRequirement(Access.All)));

builder.Services.AddAuthorizationBuilder()
	.AddPolicy(Policy.User, policy => policy.Requirements.Add(new TokenRequirement(Access.User)));

builder.Services.AddAuthorizationBuilder()
	.AddPolicy(Policy.Group, policy => policy.Requirements.Add(new TokenRequirement(Access.Group)));

builder.Services.AddAuthorizationBuilder()
	.AddPolicy(Policy.UserOrGroup, policy => policy.Requirements.Add(new TokenRequirement(Access.UserOrGroup)));

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
