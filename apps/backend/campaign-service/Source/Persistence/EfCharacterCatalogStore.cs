using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using MySqlConnector;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;

namespace Tdn.Campaigns.Persistence;

public sealed class EfCharacterCatalogStore(CampaignDbContext db) : ICharacterCatalogStore
{
    public async Task<IReadOnlyList<CharacterCatalogEntry>> ListAsync(int campaignId, Guid characterId, CancellationToken cancellationToken) =>
        await db.CharacterCatalogEntries.AsNoTracking().Where(x => x.CampaignId == campaignId && x.CharacterId == characterId).OrderBy(x => x.Id).ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<CharacterCatalogEntry>> ListByCatalogEntryAsync(int campaignId, Guid catalogEntryId, CancellationToken cancellationToken) =>
        await db.CharacterCatalogEntries.AsNoTracking().Where(x => x.CampaignId == campaignId && x.CatalogEntryId == catalogEntryId).OrderBy(x => x.CharacterId).ThenBy(x => x.Id).ToArrayAsync(cancellationToken);

    public Task<CharacterCatalogEntry?> GetAsync(int campaignId, Guid characterId, Guid entryId, CancellationToken cancellationToken) =>
        db.CharacterCatalogEntries.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.Id == entryId, cancellationToken);

    public async Task<CharacterCatalogEntry> CreateAsync(CharacterCatalogEntry entry, CancellationToken cancellationToken)
    {
        db.CharacterCatalogEntries.Add(entry);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return entry;
        }
        catch (DbUpdateException exception) when (IsMySqlDuplicate(exception))
        {
            db.ChangeTracker.Clear();
            throw new DuplicateCharacterCatalogException();
        }
    }

    public async Task<bool> UpdateQuantityAsync(int campaignId, Guid characterId, Guid entryId, decimal? quantity, long expectedRevision, CancellationToken cancellationToken) =>
        await db.CharacterCatalogEntries.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.Id == entryId && x.MetadataRevision == expectedRevision)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Quantity, quantity).SetProperty(x => x.MetadataRevision, x => x.MetadataRevision + 1), cancellationToken) == 1;

    public async Task<bool> DeleteAsync(int campaignId, Guid characterId, Guid entryId, long expectedRevision, CancellationToken cancellationToken) =>
        await db.CharacterCatalogEntries.Where(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.Id == entryId && x.MetadataRevision == expectedRevision)
            .ExecuteDeleteAsync(cancellationToken) == 1;

    public Task<CatalogAdditionReceipt?> GetAdditionAsync(int campaignId, Guid characterId, Guid requestId, CancellationToken cancellationToken) =>
        db.CatalogAdditionReceipts.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.CharacterId == characterId && x.RequestId == requestId, cancellationToken);

    public async Task<CatalogAdditionReceipt> CreateAdditionAsync(CatalogAdditionReceipt receipt, CancellationToken cancellationToken)
    {
        db.CatalogAdditionReceipts.Add(receipt);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return receipt;
        }
        catch (DbUpdateException exception) when (IsMySqlDuplicate(exception))
        {
            db.ChangeTracker.Clear();
            throw new DuplicateCharacterCatalogException();
        }
    }

    public async Task<T> WithDefinitionLockAsync<T>(int campaignId, Guid catalogEntryId, Func<Task<T>> action, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockDefinitionAsync(campaignId, catalogEntryId, cancellationToken);
        var result = await action();
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task<T> WithCharacterLockAsync<T>(int campaignId, Guid catalogEntryId, Guid characterId, Func<Task<T>> action, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockDefinitionAsync(campaignId, catalogEntryId, cancellationToken);
        await LockCharacterAsync(campaignId, characterId, cancellationToken);
        var result = await action();
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    public async Task<T> WithNewDefinitionCharacterLockAsync<T>(int campaignId, Guid characterId, Func<Task<T>> action, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockCharacterAsync(campaignId, characterId, cancellationToken);
        var result = await action();
        await transaction.CommitAsync(cancellationToken);
        return result;
    }

    private async Task LockDefinitionAsync(int campaignId, Guid catalogEntryId, CancellationToken cancellationToken)
    {
        if (!await LockRowAsync("CatalogEntries", "Id", campaignId, catalogEntryId, cancellationToken)) throw NotFound(catalogEntryId);
    }

    private async Task LockCharacterAsync(int campaignId, Guid characterId, CancellationToken cancellationToken)
    {
        if (!await LockRowAsync("CharacterMetadata", "Id", campaignId, characterId, cancellationToken)) throw NotFound(characterId);
    }

    private async Task<bool> LockRowAsync(string table, string idColumn, int campaignId, Guid id, CancellationToken cancellationToken)
    {
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = db.Database.CurrentTransaction!.GetDbTransaction();
        command.CommandText = $"SELECT 1 FROM `{table}` WHERE `CampaignId` = @campaignId AND `{idColumn}` = @id FOR UPDATE";
        var campaignParameter = command.CreateParameter();
        campaignParameter.ParameterName = "@campaignId";
        campaignParameter.Value = campaignId;
        command.Parameters.Add(campaignParameter);
        var idParameter = command.CreateParameter();
        idParameter.ParameterName = "@id";
        idParameter.DbType = DbType.String;
        idParameter.Value = id.ToString("D");
        command.Parameters.Add(idParameter);
        return await command.ExecuteScalarAsync(cancellationToken) is not null;
    }

    private static bool IsMySqlDuplicate(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is MySqlException mysql && mysql.Number == 1062) return true;
        return false;
    }

    private static DomainException NotFound(Guid id) => new(404, "not_found", "The requested resource was not found.", id);
}
