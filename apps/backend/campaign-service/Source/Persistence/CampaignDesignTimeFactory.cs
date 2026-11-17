using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;

namespace Tdn.Campaigns.Persistence;

public sealed class CampaignDesignTimeFactory : IDesignTimeDbContextFactory<CampaignDbContext>
{
    public CampaignDbContext CreateDbContext(string[] args)
    {
        var environment = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? "Production";
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables()
            .AddCommandLine(args)
            .Build();
        var connectionString = configuration["MYSQL_CONNECTION_STRING"];
        var versionText = configuration["MySql:ServerVersion"] ?? "8.0.36";
        if (!Version.TryParse(versionText, out var version))
            throw new InvalidOperationException("MySql:ServerVersion must be a valid version.");
        var options = new DbContextOptionsBuilder<CampaignDbContext>()
            .UseMySql(connectionString ?? string.Empty, new MySqlServerVersion(version))
            .Options;
        return new CampaignDbContext(options);
    }
}
