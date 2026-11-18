using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MySqlConnector;
using Tdn.Campaigns;
using Tdn.Campaigns.Configuration;
using Tdn.Campaigns.Persistence;

namespace CampaignService.Tests;

public class HostingTests
{
    [Fact]
    public async Task BuildAppliesMigrationsByDefault()
    {
        await using var app = CampaignApplication.Build([
            "--MYSQL_CONNECTION_STRING", "Server=127.0.0.1;Database=unit_campaign;User ID=unit_user;",
            "--MONGO_CONNECTION_STRING", "mongodb://127.0.0.1:27017",
            "--MONGO_DATABASE", "unit_content"
        ]);

        Assert.True(new CampaignDatabaseOptions().ApplyMigrations);
        Assert.True(app.Services.GetRequiredService<IOptions<CampaignDatabaseOptions>>().Value.ApplyMigrations);
        Assert.Single(app.Services.GetServices<IHostedService>().OfType<DatabaseMigrationService>());
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task BuildRespectsExplicitMigrationSetting(bool expected)
    {
        await using var app = CampaignApplication.Build([
            "--MYSQL_CONNECTION_STRING", "Server=127.0.0.1;Database=unit_campaign;User ID=unit_user;",
            "--MONGO_CONNECTION_STRING", "mongodb://127.0.0.1:27017",
            "--MONGO_DATABASE", "unit_content",
            "--Database:ApplyMigrations", expected.ToString()
        ]);

        Assert.Equal(expected, app.Services.GetRequiredService<IOptions<CampaignDatabaseOptions>>().Value.ApplyMigrations);
        Assert.Equal(expected ? 1 : 0, app.Services.GetServices<IHostedService>().OfType<DatabaseMigrationService>().Count());
    }

    [Fact]
    public async Task BuildRejectsInvalidMigrationSettingWhenOptionsAreResolved()
    {
        await using var app = CampaignApplication.Build([
            "--MYSQL_CONNECTION_STRING", "Server=127.0.0.1;Database=unit_campaign;User ID=unit_user;",
            "--MONGO_CONNECTION_STRING", "mongodb://127.0.0.1:27017",
            "--MONGO_DATABASE", "unit_content",
            "--Database:ApplyMigrations", "not-a-boolean"
        ]);

        var exception = Assert.Throws<OptionsValidationException>(() =>
            app.Services.GetRequiredService<IOptions<CampaignDatabaseOptions>>().Value);

        Assert.Contains("Database:ApplyMigrations must be a boolean.", exception.Failures);
    }

    [Fact]
    public async Task BuildUsesCommandLineUrlsAndRegistersConfiguration()
    {
        await using var app = CampaignApplication.Build(["--urls", "http://127.0.0.1:5099"]);

        Assert.Equal("http://127.0.0.1:5099", app.Configuration["urls"]);
        Assert.IsAssignableFrom<IConfiguration>(app.Configuration);
    }

    [Fact]
    public async Task BuildAddsCommandLineValuesToConfiguration()
    {
        await using var app = CampaignApplication.Build(["--Example:Value", "configured"]);

        Assert.Equal("configured", app.Configuration["Example:Value"]);
    }

    [Fact]
    public async Task BuildUsesCanonicalDatabaseSettings()
    {
        const string sqlConnectionString = "Server=127.0.0.1;Database=unit_campaign;User ID=unit_user;";
        const string mongoConnectionString = "mongodb://127.0.0.1:27017";
        const string mongoDatabase = "unit_content";
        await using var app = CampaignApplication.Build([
            "--MYSQL_CONNECTION_STRING", sqlConnectionString,
            "--MONGO_CONNECTION_STRING", mongoConnectionString,
            "--MONGO_DATABASE", mongoDatabase
        ]);

        var campaignOptions = app.Services.GetRequiredService<IOptions<CampaignDatabaseOptions>>().Value;
        var mongoOptions = app.Services.GetRequiredService<IOptions<MongoOptions>>().Value;
        Assert.Equal(sqlConnectionString, campaignOptions.ConnectionString);
        Assert.Equal(mongoConnectionString, mongoOptions.ConnectionString);
        Assert.Equal(mongoDatabase, mongoOptions.Database);

        using var scope = app.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<CampaignDbContext>();
        var connectionString = context.Database.GetConnectionString();
        Assert.NotNull(connectionString);
        var actual = new MySqlConnectionStringBuilder(connectionString);
        var expected = new MySqlConnectionStringBuilder(sqlConnectionString);
        Assert.Equal(expected.Server, actual.Server);
        Assert.Equal(expected.Database, actual.Database);
        Assert.Equal(expected.UserID, actual.UserID);
    }

    [Fact]
    public async Task BuildUsesCanonicalSettingsInsteadOfNestedSettings()
    {
        const string sqlConnectionString = "Server=127.0.0.1;Database=unit_canonical;User ID=canonical_user;";
        const string mongoConnectionString = "mongodb://127.0.0.1:27017/canonical";
        const string mongoDatabase = "canonical_content";
        await using var app = CampaignApplication.Build([
            "--MYSQL_CONNECTION_STRING", sqlConnectionString,
            "--MONGO_CONNECTION_STRING", mongoConnectionString,
            "--MONGO_DATABASE", mongoDatabase,
            "--ConnectionStrings:MySql", "Server=127.0.0.1;Database=unit_nested;User ID=nested_user;",
            "--Mongo:ConnectionString", "mongodb://127.0.0.1:27018/nested",
            "--Mongo:Database", "nested_content"
        ]);

        var campaignOptions = app.Services.GetRequiredService<IOptions<CampaignDatabaseOptions>>().Value;
        var mongoOptions = app.Services.GetRequiredService<IOptions<MongoOptions>>().Value;
        Assert.Equal(sqlConnectionString, campaignOptions.ConnectionString);
        Assert.Equal(mongoConnectionString, mongoOptions.ConnectionString);
        Assert.Equal(mongoDatabase, mongoOptions.Database);
    }

    [Theory]
    [InlineData("MYSQL_CONNECTION_STRING", "")]
    [InlineData("MYSQL_CONNECTION_STRING", "   ")]
    [InlineData("MONGO_CONNECTION_STRING", "")]
    [InlineData("MONGO_CONNECTION_STRING", "   ")]
    [InlineData("MONGO_DATABASE", "")]
    [InlineData("MONGO_DATABASE", "   ")]
    public async Task NestedSettingsDoNotOverrideEmptyCanonicalSettings(string setting, string value)
    {
        await using var app = CampaignApplication.Build([
            "--MYSQL_CONNECTION_STRING", setting == "MYSQL_CONNECTION_STRING" ? value : "Server=127.0.0.1;Database=unit_campaign;User ID=unit_user;",
            "--MONGO_CONNECTION_STRING", setting == "MONGO_CONNECTION_STRING" ? value : "mongodb://127.0.0.1:27017",
            "--MONGO_DATABASE", setting == "MONGO_DATABASE" ? value : "unit_content",
            "--ConnectionStrings:MySql", "Server=127.0.0.1;Database=nested;User ID=nested_user;",
            "--Mongo:ConnectionString", "mongodb://127.0.0.1:27018/nested",
            "--Mongo:Database", "nested_content"
        ]);

        var exception = Assert.Throws<OptionsValidationException>(() =>
        {
            if (setting == "MYSQL_CONNECTION_STRING")
                _ = app.Services.GetRequiredService<IOptions<CampaignDatabaseOptions>>().Value;
            else
                _ = app.Services.GetRequiredService<IOptions<MongoOptions>>().Value;
        });

        Assert.Contains($"{setting} is required.", exception.Failures);
    }

    [Fact]
    public void DesignTimeFactoryUsesCanonicalSqlSetting()
    {
        const string sqlConnectionString = "Server=127.0.0.1;Database=unit_campaign;User ID=unit_user;";
        using var context = new CampaignDesignTimeFactory().CreateDbContext(["--MYSQL_CONNECTION_STRING", sqlConnectionString]);

        var connectionString = context.Database.GetConnectionString();
        Assert.NotNull(connectionString);
        var actual = new MySqlConnectionStringBuilder(connectionString);
        var expected = new MySqlConnectionStringBuilder(sqlConnectionString);
        Assert.Equal(expected.Server, actual.Server);
        Assert.Equal(expected.Database, actual.Database);
        Assert.Equal(expected.UserID, actual.UserID);
    }
}
