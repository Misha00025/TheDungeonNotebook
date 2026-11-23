namespace Tdn.Campaigns.Catalog;

public interface ICharacterCatalogStore<TCatalog> where TCatalog : ICatalogType
{
    Task<IReadOnlyList<CharacterCatalogEntry<TCatalog>>> ListAsync(int campaignId, Guid characterId, CancellationToken cancellationToken);
    Task<IReadOnlyList<CharacterCatalogEntry<TCatalog>>> ListByCatalogEntryAsync(int campaignId, Guid catalogEntryId, CancellationToken cancellationToken);
    Task<CharacterCatalogEntry<TCatalog>?> GetAsync(int campaignId, Guid characterId, Guid entryId, CancellationToken cancellationToken);
    Task<CharacterCatalogEntry<TCatalog>> CreateAsync(CharacterCatalogEntry<TCatalog> entry, CancellationToken cancellationToken);
    Task<bool> UpdateQuantityAsync(int campaignId, Guid characterId, Guid entryId, decimal? quantity, long expectedRevision, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int campaignId, Guid characterId, Guid entryId, long expectedRevision, CancellationToken cancellationToken);
    Task<CatalogAdditionReceipt<TCatalog>?> GetAdditionAsync(int campaignId, Guid characterId, Guid requestId, CancellationToken cancellationToken);
    Task<CatalogAdditionReceipt<TCatalog>> CreateAdditionAsync(CatalogAdditionReceipt<TCatalog> receipt, CancellationToken cancellationToken);
    Task<T> WithDefinitionLockAsync<T>(int campaignId, Guid catalogEntryId, Func<Task<T>> action, CancellationToken cancellationToken);
    Task<T> WithCharacterLockAsync<T>(int campaignId, Guid catalogEntryId, Guid characterId, Func<Task<T>> action, CancellationToken cancellationToken);
    Task<T> WithNewDefinitionCharacterLockAsync<T>(int campaignId, Guid characterId, Func<Task<T>> action, CancellationToken cancellationToken);
}

public sealed class DuplicateCharacterCatalogException : Exception { }
