namespace Tdn.Campaigns.Sheets;

public interface IContentStore
{
    Task<ContentEnvelope<T>?> GetAsync<T>(string collection, int campaignId, Guid resourceId, CancellationToken cancellationToken);
    Task<ContentEnvelope<T>> CreateAsync<T>(string collection, int campaignId, Guid resourceId, T data, CancellationToken cancellationToken);
    Task<ContentEnvelope<T>?> ReplaceAsync<T>(string collection, int campaignId, Guid resourceId, long expectedRevision, T data, CancellationToken cancellationToken);
}

public sealed class ContentAlreadyPreparedException : Exception
{
}

public sealed class ContentStoreException(bool writeOutcomeUnknown) : Exception("The content store operation could not be confirmed.")
{
    public bool WriteOutcomeUnknown { get; } = writeOutcomeUnknown;
}
