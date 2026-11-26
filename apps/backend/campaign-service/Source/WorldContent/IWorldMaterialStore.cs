namespace Tdn.Campaigns.WorldContent;

public interface IWorldMaterialStore
{
    Task<IReadOnlyList<WorldMaterial>> ListAsync(int campaignId, string kind, string? tag, CancellationToken ct);
    Task<WorldMaterial?> GetAsync(int campaignId, string kind, Guid id, CancellationToken ct);
    Task<WorldMaterial> CreateAsync(WorldMaterial material, CancellationToken ct);
    Task<bool> UpdateAsync(int campaignId, string kind, Guid id, string title, string description, string tags, bool isPublished, long expectedRevision, CancellationToken ct);
    Task<bool> DeleteAsync(int campaignId, string kind, Guid id, long expectedRevision, CancellationToken ct);
}
