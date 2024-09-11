using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using TdnApi.Models.Db;
using TdnApi.Security;
using static ConnectionSettings;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMvc();

builder.Services.AddDbContext<UserContext>(opt => opt.UseMySql(Connection, new MySqlServerVersion(new Version(8, 0, 11))));
builder.Services.AddSingleton<IAuthorizationHandler, TokenHandler>();

builder.Services.AddAuthorizationBuilder()
	.AddPolicy("All", policy => policy.Requirements.Add(new TokenRequirement(Access.All)));

builder.Services.AddAuthorizationBuilder()
	.AddPolicy("User", policy => policy.Requirements.Add(new TokenRequirement(Access.User)));

builder.Services.AddAuthorizationBuilder()
	.AddPolicy("Group", policy => policy.Requirements.Add(new TokenRequirement(Access.Group)));

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("UserOrGroup", policy => policy.Requirements.Add(new TokenRequirement(Access.UserOrGroup)));

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
