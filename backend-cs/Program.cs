using Microsoft.EntityFrameworkCore;
using TdnApi.Models.Db;
using TdnApi.Security;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddMvc();

builder.Services.AddDbContext<UserContext>(opt => opt.UseMySql("server=localhost;port=3307;user=test_user;password=1234;database=test_vk;", new MySqlServerVersion(new Version(8, 0, 11))));

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


record UserRequest( string? name, string? lastName );
