using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.Json.Serialization;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Configuration;
using Tdn.Campaigns.Http;
using Tdn.Campaigns.Persistence;

namespace Tdn.Campaigns;

public static class CampaignApplication
{
    public static WebApplication Build(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        var migrationValue = builder.Configuration["Database:ApplyMigrations"];

        builder.Services.AddProblemDetails();
        builder.Services.AddExceptionHandler<CampaignExceptionHandler>();
        builder.Services.AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
                options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            })
            .ConfigureApiBehaviorOptions(options =>
            {
                options.InvalidModelStateResponseFactory = context =>
                {
                    var problem = new ValidationProblemDetails(context.ModelState)
                    {
                        Status = StatusCodes.Status400BadRequest,
                        Title = "The request is invalid."
                    };
                    problem.Extensions["code"] = "invalid_request";
                    return new BadRequestObjectResult(problem);
                };
            });

        builder.Services.AddOptions<CampaignDatabaseOptions>()
            .Configure(options =>
            {
                options.ConnectionString = builder.Configuration.GetConnectionString("MySql") ?? string.Empty;
                options.ServerVersion = builder.Configuration["MySql:ServerVersion"] ?? "8.0.36";
                options.ApplyMigrations = bool.TryParse(migrationValue, out var apply) && apply;
            })
            .Validate(options => !string.IsNullOrWhiteSpace(options.ConnectionString), "ConnectionStrings:MySql is required.")
            .Validate(options => Version.TryParse(options.ServerVersion, out _), "MySql:ServerVersion must be a valid version.")
            .Validate(options => migrationValue is null || bool.TryParse(migrationValue, out _), "Database:ApplyMigrations must be a boolean.")
            .ValidateOnStart();

        builder.Services.AddDbContext<CampaignDbContext>((services, options) =>
        {
            var database = services.GetRequiredService<IOptions<CampaignDatabaseOptions>>().Value;
            options.UseMySql(database.ConnectionString, new MySqlServerVersion(Version.Parse(database.ServerVersion)));
        });
        builder.Services.AddScoped<ICampaignStore, EfCampaignStore>();
        builder.Services.AddScoped<CampaignService>();
        if (bool.TryParse(migrationValue, out var applyMigrations) && applyMigrations)
            builder.Services.AddHostedService<DatabaseMigrationService>();

        var app = builder.Build();
        app.UseExceptionHandler();
        app.MapControllers();
        return app;
    }
}
