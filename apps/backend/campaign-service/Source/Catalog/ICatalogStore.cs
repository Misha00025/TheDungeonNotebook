namespace Tdn.Campaigns.Catalog;

public interface ICatalogStore<TCatalog> where TCatalog : ICatalogType
{
    Task<IReadOnlyList<CatalogEntry<TCatalog>>> ListAsync(int campaignId, CancellationToken cancellationToken);
    Task<CatalogEntry<TCatalog>?> GetAsync(int campaignId, Guid id, CancellationToken cancellationToken);
    Task<CatalogEntry<TCatalog>> CreateAsync(CatalogEntry<TCatalog> entry, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(int campaignId, Guid id, string name, bool isHidden, QuantityUnit? quantityUnit, bool allowNegative, long expectedRevision, CancellationToken cancellationToken);
}
