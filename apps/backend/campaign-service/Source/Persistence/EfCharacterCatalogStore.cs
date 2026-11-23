using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using MySqlConnector;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;

namespace Tdn.Campaigns.Persistence;

public sealed class EfCharacterCatalogStore<TCatalog>(CampaignDbContext db) : ICharacterCatalogStore<TCatalog> where TCatalog : ICatalogType
{
    public async Task<IReadOnlyList<CharacterCatalogEntry<TCatalog>>> ListAsync(int campaignId, Guid characterId, CancellationToken ct) => await db.Set<CharacterCatalogEntry<TCatalog>>().AsNoTracking().Where(x => x.CampaignId == campaignId && x.CharacterId == characterId).OrderBy(x => x.Id).ToArrayAsync(ct);
    public async Task<IReadOnlyList<CharacterCatalogEntry<TCatalog>>> ListByCatalogEntryAsync(int campaignId, Guid catalogEntryId, CancellationToken ct) => await db.Set<CharacterCatalogEntry<TCatalog>>().AsNoTracking().Where(x => x.CampaignId == campaignId && x.CatalogEntryId == catalogEntryId).OrderBy(x => x.CharacterId).ThenBy(x => x.Id).ToArrayAsync(ct);
    public Task<CharacterCatalogEntry<TCatalog>?> GetAsync(int campaignId, Guid characterId, Guid entryId, CancellationToken ct) => db.Set<CharacterCatalogEntry<TCatalog>>().AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.Id == entryId, ct);

    public async Task<CharacterCatalogEntry<TCatalog>> CreateAsync(CharacterCatalogEntry<TCatalog> entry, CancellationToken ct)
    {
        db.Set<CharacterCatalogEntry<TCatalog>>().Add(entry);
        try { await db.SaveChangesAsync(ct); return entry; }
        catch (DbUpdateException exception) when (IsDuplicate(exception)) { db.ChangeTracker.Clear(); throw new DuplicateCharacterCatalogException(); }
    }

    public async Task<bool> UpdateQuantityAsync(int campaignId, Guid characterId, Guid entryId, decimal? quantity, long expectedRevision, CancellationToken ct) => await db.Set<CharacterCatalogEntry<TCatalog>>().Where(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.Id == entryId && x.MetadataRevision == expectedRevision).ExecuteUpdateAsync(s => s.SetProperty(x => x.Quantity, quantity).SetProperty(x => x.MetadataRevision, x => x.MetadataRevision + 1), ct) == 1;
    public async Task<bool> DeleteAsync(int campaignId, Guid characterId, Guid entryId, long expectedRevision, CancellationToken ct) => await db.Set<CharacterCatalogEntry<TCatalog>>().Where(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.Id == entryId && x.MetadataRevision == expectedRevision).ExecuteDeleteAsync(ct) == 1;
    public Task<CatalogAdditionReceipt<TCatalog>?> GetAdditionAsync(int campaignId, Guid characterId, Guid requestId, CancellationToken ct) => db.Set<CatalogAdditionReceipt<TCatalog>>().AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.RequestId == requestId, ct);

    public async Task<CatalogAdditionReceipt<TCatalog>> CreateAdditionAsync(CatalogAdditionReceipt<TCatalog> receipt, CancellationToken ct)
    {
        db.Set<CatalogAdditionReceipt<TCatalog>>().Add(receipt);
        try { await db.SaveChangesAsync(ct); return receipt; }
        catch (DbUpdateException exception) when (IsDuplicate(exception)) { db.ChangeTracker.Clear(); throw new DuplicateCharacterCatalogException(); }
    }

    public async Task<T> WithDefinitionLockAsync<T>(int campaignId, Guid catalogEntryId, Func<Task<T>> action, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await LockRowAsync(TCatalog.DefinitionsTable, "Id", campaignId, catalogEntryId, ct)) throw NotFound(catalogEntryId);
        var result = await action();
        await transaction.CommitAsync(ct);
        return result;
    }

    public async Task<T> WithCharacterLockAsync<T>(int campaignId, Guid catalogEntryId, Guid characterId, Func<Task<T>> action, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await LockRowAsync(TCatalog.DefinitionsTable, "Id", campaignId, catalogEntryId, ct)) throw NotFound(catalogEntryId);
        if (!await LockRowAsync("CharacterMetadata", "Id", campaignId, characterId, ct)) throw NotFound(characterId);
        var result = await action();
        await transaction.CommitAsync(ct);
        return result;
    }

    public async Task<T> WithNewDefinitionCharacterLockAsync<T>(int campaignId, Guid characterId, Func<Task<T>> action, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (!await LockRowAsync("CharacterMetadata", "Id", campaignId, characterId, ct)) throw NotFound(characterId);
        var result = await action();
        await transaction.CommitAsync(ct);
        return result;
    }

    private async Task<bool> LockRowAsync(string table, string idColumn, int campaignId, Guid id, CancellationToken ct)
    {
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = db.Database.CurrentTransaction!.GetDbTransaction();
        command.CommandText = $"SELECT 1 FROM `{table}` WHERE `CampaignId` = @campaignId AND `{idColumn}` = @id FOR UPDATE";
        var cp = command.CreateParameter(); cp.ParameterName = "@campaignId"; cp.Value = campaignId; command.Parameters.Add(cp);
        var ip = command.CreateParameter(); ip.ParameterName = "@id"; ip.DbType = DbType.String; ip.Value = id.ToString("D"); command.Parameters.Add(ip);
        return await command.ExecuteScalarAsync(ct) is not null;
    }

    private static bool IsDuplicate(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is MySqlException mysql && mysql.Number == 1062) return true;
        return false;
    }
    private static DomainException NotFound(Guid id) => new(404, "not_found", "The requested resource was not found.", id);
}
