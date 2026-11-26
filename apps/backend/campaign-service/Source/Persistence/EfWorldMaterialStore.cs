using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using Tdn.Campaigns.WorldContent;

namespace Tdn.Campaigns.Persistence;

public sealed class EfWorldMaterialStore(CampaignDbContext db) : IWorldMaterialStore
{
    public async Task<IReadOnlyList<WorldMaterial>> ListAsync(int campaignId, string kind, string? tag, CancellationToken ct)
    {
        var query = db.WorldMaterials.AsNoTracking().Where(x => x.CampaignId == campaignId && x.Kind == kind);
        var materials = await query.OrderBy(x => x.Title).ToArrayAsync(ct);
        return tag is null ? materials : materials.Where(x => System.Text.Json.JsonSerializer.Deserialize<string[]>(x.Tags)!.Contains(tag, StringComparer.Ordinal)).ToArray();
    }

    public Task<WorldMaterial?> GetAsync(int campaignId, string kind, Guid id, CancellationToken ct) =>
        db.WorldMaterials.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.Kind == kind && x.Id == id, ct);

    public async Task<WorldMaterial> CreateAsync(WorldMaterial material, CancellationToken ct)
    {
        db.WorldMaterials.Add(material);
        try { await db.SaveChangesAsync(ct); return material; }
        catch (DbUpdateException exception) when (IsDuplicate(exception)) { db.ChangeTracker.Clear(); throw new WorldMaterialDuplicateException(); }
    }

    public async Task<bool> UpdateAsync(int campaignId, string kind, Guid id, string title, string description, string tags, bool isPublished, long expectedRevision, CancellationToken ct) =>
        await db.WorldMaterials.Where(x => x.CampaignId == campaignId && x.Kind == kind && x.Id == id && x.MetadataRevision == expectedRevision)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Title, title).SetProperty(x => x.Description, description).SetProperty(x => x.Tags, tags).SetProperty(x => x.IsPublished, isPublished).SetProperty(x => x.MetadataRevision, x => x.MetadataRevision + 1), ct)
            == 1;

    public async Task<bool> DeleteAsync(int campaignId, string kind, Guid id, long expectedRevision, CancellationToken ct) =>
        await db.WorldMaterials.Where(x => x.CampaignId == campaignId && x.Kind == kind && x.Id == id && x.MetadataRevision == expectedRevision).ExecuteDeleteAsync(ct) == 1;

    private static bool IsDuplicate(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is MySqlException mysql && mysql.Number == 1062) return true;
        return false;
    }
}

public sealed class WorldMaterialDuplicateException : Exception { }
