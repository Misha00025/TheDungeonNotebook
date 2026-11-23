namespace Tdn.Campaigns.Persistence;

public interface ILegacyCatalogCleanup
{
    Task PurgeAsync(CancellationToken cancellationToken);
}
