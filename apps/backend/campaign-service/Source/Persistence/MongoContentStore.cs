using System.Text.Json;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Driver;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Persistence;

public sealed class MongoContentStore(IMongoDatabase database) : IContentStore
{
    public async Task<ContentEnvelope<T>?> GetAsync<T>(string collection, int campaignId, Guid resourceId, CancellationToken cancellationToken)
    {
        var document = await database.GetCollection<BsonDocument>(collection)
            .Find(Builders<BsonDocument>.Filter.Eq("_id", DocumentId(campaignId, resourceId)) &
                  Builders<BsonDocument>.Filter.Eq("campaignId", campaignId) &
                  Builders<BsonDocument>.Filter.Eq("resourceId", resourceId.ToString("D")))
            .FirstOrDefaultAsync(cancellationToken);
        return document is null ? null : ToEnvelope<T>(document);
    }

    public async Task<ContentEnvelope<T>> CreateAsync<T>(string collection, int campaignId, Guid resourceId, T data, CancellationToken cancellationToken)
    {
        var envelope = new ContentEnvelope<T>(campaignId, resourceId, 1, data);
        try
        {
            await database.GetCollection<BsonDocument>(collection).InsertOneAsync(ToDocument(envelope), cancellationToken: cancellationToken);
            return envelope;
        }
        catch (MongoWriteException exception) when (exception.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new ContentAlreadyPreparedException();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (MongoException) when (cancellationToken.IsCancellationRequested)
        {
            throw new OperationCanceledException(cancellationToken);
        }
        catch (MongoException)
        {
            throw new ContentStoreException(true);
        }
    }

    public async Task<ContentEnvelope<T>?> ReplaceAsync<T>(string collection, int campaignId, Guid resourceId, long expectedRevision, T data, CancellationToken cancellationToken)
    {
        var next = new ContentEnvelope<T>(campaignId, resourceId, expectedRevision + 1, data);
        var filter = Builders<BsonDocument>.Filter.Eq("_id", DocumentId(campaignId, resourceId)) &
                     Builders<BsonDocument>.Filter.Eq("campaignId", campaignId) &
                     Builders<BsonDocument>.Filter.Eq("resourceId", resourceId.ToString("D")) &
                     Builders<BsonDocument>.Filter.Eq("contentRevision", expectedRevision);
        try
        {
            var result = await database.GetCollection<BsonDocument>(collection).ReplaceOneAsync(filter, ToDocument(next), cancellationToken: cancellationToken);
            return result.MatchedCount == 1 ? next : null;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (MongoException) when (cancellationToken.IsCancellationRequested)
        {
            throw new OperationCanceledException(cancellationToken);
        }
        catch (MongoException)
        {
            throw new ContentStoreException(true);
        }
    }

    private static string DocumentId(int campaignId, Guid resourceId) => $"{campaignId}:{resourceId:N}";

    private static BsonDocument ToDocument<T>(ContentEnvelope<T> envelope)
    {
        var json = JsonSerializer.Serialize(envelope.Data);
        return new BsonDocument
        {
            ["_id"] = DocumentId(envelope.CampaignId, envelope.ResourceId),
            ["campaignId"] = envelope.CampaignId,
            ["resourceId"] = envelope.ResourceId.ToString("D"),
            ["contentRevision"] = envelope.ContentRevision,
            ["data"] = BsonDocument.Parse(json)
        };
    }

    private static ContentEnvelope<T> ToEnvelope<T>(BsonDocument document)
    {
        var json = document["data"].AsBsonDocument.ToJson(new JsonWriterSettings { OutputMode = JsonOutputMode.RelaxedExtendedJson });
        var data = JsonSerializer.Deserialize<T>(json)!;
        return new ContentEnvelope<T>(document["campaignId"].AsInt32, Guid.Parse(document["resourceId"].AsString), document["contentRevision"].ToInt64(), data);
    }
}
