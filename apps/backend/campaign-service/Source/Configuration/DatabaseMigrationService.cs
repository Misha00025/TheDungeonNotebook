using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tdn.Campaigns.Persistence;

namespace Tdn.Campaigns.Configuration;

public sealed class DatabaseMigrationService(IServiceProvider services, IOptions<CampaignDatabaseOptions> options) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!options.Value.ApplyMigrations)
            return;
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CampaignDbContext>();
        await db.Database.MigrateAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
