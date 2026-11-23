using System.Data;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace Tdn.Campaigns.Persistence;

public sealed class LegacyCatalogCleanup(CampaignDbContext db, IMongoDatabase mongo, ILogger<LegacyCatalogCleanup> logger) : ILegacyCatalogCleanup
{
    private static readonly string[] SqlTables = ["CatalogAdditionReceipts", "CharacterCatalogEntries", "CatalogEntries"];
    private static readonly string[] MongoCollections = ["catalogAttributeDefinitions", "catalogContents", "characterCatalogContents", "catalogGroups"];

    public async Task PurgeAsync(CancellationToken cancellationToken)
    {
        await PurgeSql(cancellationToken);
        foreach (var collection in MongoCollections)
            await mongo.GetCollection<MongoDB.Bson.BsonDocument>(collection).DeleteManyAsync(FilterDefinition<MongoDB.Bson.BsonDocument>.Empty, cancellationToken);
        logger.LogInformation("Purged legacy catalog data from {SqlTables} and {MongoCollections}.", SqlTables, MongoCollections);
    }

    private async Task PurgeSql(CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        var openedHere = connection.State != ConnectionState.Open;
        if (openedHere) await connection.OpenAsync(ct);
        try
        {
            await using var transaction = await connection.BeginTransactionAsync(ct);
            foreach (var table in SqlTables)
            {
                await using var exists = connection.CreateCommand();
                exists.Transaction = transaction;
                exists.CommandText = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = @tableName";
                var parameter = exists.CreateParameter();
                parameter.ParameterName = "@tableName";
                parameter.Value = table;
                exists.Parameters.Add(parameter);
                if (Convert.ToInt64(await exists.ExecuteScalarAsync(ct)) == 0) continue;
                await using var delete = connection.CreateCommand();
                delete.Transaction = transaction;
                delete.CommandText = $"DELETE FROM `{table}`";
                await delete.ExecuteNonQueryAsync(ct);
            }
            await transaction.CommitAsync(ct);
        }
        finally
        {
            if (openedHere) await connection.CloseAsync();
        }
    }
}
