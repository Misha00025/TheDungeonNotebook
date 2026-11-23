using Tdn.Campaigns.Persistence;

namespace Tdn.Campaigns.Configuration;

public sealed class LegacyCatalogCleanupService(IServiceScopeFactory scopes, ILogger<LegacyCatalogCleanupService> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ILegacyCatalogCleanup>().PurgeAsync(cancellationToken);
        logger.LogInformation("Legacy catalog startup cleanup completed.");
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
