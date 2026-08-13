using System;
using Tdn.Configuration;
using Tdn.Settings;
using Xunit;

namespace Tdn.Tests.Source;

public class MongoDbSettingsTests
{
    [Fact]
    public void GetMongoDbSettings_ReturnsSettings_WithConfiguredDatabaseName()
    {
        Environment.SetEnvironmentVariable("MONGO_CONNECTION_STRING", "mongodb://localhost:27017/");
        Environment.SetEnvironmentVariable("MYSQL_CONNECTION_STRING", "server=localhost;database=test;user=root;password=test;");
        Environment.SetEnvironmentVariable("MONGO_SETTINGS_DATABASE", "tdn-settings");

        var config = new ConfigParser();
        var settings = config.GetMongoDbSettings();

        Assert.NotNull(settings);
        Assert.Equal("tdn-settings", settings.DatabaseName);
        Assert.Equal("mongodb://localhost:27017/", settings.ConnectionString);

        Environment.SetEnvironmentVariable("MONGO_CONNECTION_STRING", null);
        Environment.SetEnvironmentVariable("MYSQL_CONNECTION_STRING", null);
        Environment.SetEnvironmentVariable("MONGO_SETTINGS_DATABASE", null);
    }

    [Fact]
    public void GetMongoDbSettings_ReturnsNull_WhenConnectionStringIsEmpty()
    {
        Environment.SetEnvironmentVariable("MONGO_CONNECTION_STRING", null);
        Environment.SetEnvironmentVariable("MYSQL_CONNECTION_STRING", "server=localhost;database=test;user=root;password=test;");
        Environment.SetEnvironmentVariable("MONGO_SETTINGS_DATABASE", null);

        var config = new ConfigParser();
        var settings = config.GetMongoDbSettings();

        Assert.Null(settings);

        Environment.SetEnvironmentVariable("MYSQL_CONNECTION_STRING", null);
    }

    [Fact]
    public void GetMongoDbSettings_DefaultsDatabaseName_WhenEnvVarNotSet()
    {
        Environment.SetEnvironmentVariable("MONGO_CONNECTION_STRING", "mongodb://localhost:27017/");
        Environment.SetEnvironmentVariable("MYSQL_CONNECTION_STRING", "server=localhost;database=test;user=root;password=test;");
        Environment.SetEnvironmentVariable("MONGO_SETTINGS_DATABASE", null);

        var config = new ConfigParser();
        var settings = config.GetMongoDbSettings();

        Assert.NotNull(settings);
        Assert.Equal("tdn-settings", settings.DatabaseName);

        Environment.SetEnvironmentVariable("MONGO_CONNECTION_STRING", null);
        Environment.SetEnvironmentVariable("MYSQL_CONNECTION_STRING", null);
    }
}
