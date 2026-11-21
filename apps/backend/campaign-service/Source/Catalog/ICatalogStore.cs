namespace Tdn.Campaigns.Catalog;

public interface ICatalogStore
{
    Task<IReadOnlyList<CatalogEntry>> ListAsync(int campaignId, CatalogKind? kind, CancellationToken cancellationToken);
    Task<CatalogEntry?> GetAsync(int campaignId, Guid id, CancellationToken cancellationToken);
    Task<CatalogEntry> CreateAsync(CatalogEntry entry, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(int campaignId, Guid id, string name, bool isHidden, QuantityUnit? quantityUnit, bool allowNegative, long expectedRevision, CancellationToken cancellationToken);
}
