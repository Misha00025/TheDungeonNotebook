using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Persistence;

public sealed class EfCatalogStore(CampaignDbContext db) : ICatalogStore
{
    public async Task<IReadOnlyList<CatalogEntry>> ListAsync(int campaignId, CatalogKind? kind, CancellationToken cancellationToken) =>
        await db.CatalogEntries.AsNoTracking().Where(x => x.CampaignId == campaignId && (kind == null || x.Kind == kind)).OrderBy(x => x.Name).ToArrayAsync(cancellationToken);

    public Task<CatalogEntry?> GetAsync(int campaignId, Guid id, CancellationToken cancellationToken) =>
        db.CatalogEntries.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.Id == id, cancellationToken);

    public async Task<CatalogEntry> CreateAsync(CatalogEntry entry, CancellationToken cancellationToken)
    {
        db.CatalogEntries.Add(entry);
        try { await db.SaveChangesAsync(cancellationToken); return entry; }
        catch (DbUpdateException exception) when (IsDuplicate(exception)) { db.ChangeTracker.Clear(); throw new DuplicateResourceException(); }
    }

    public async Task<bool> UpdateAsync(int campaignId, Guid id, string name, bool isHidden, QuantityUnit? quantityUnit, bool allowNegative, long expectedRevision, CancellationToken cancellationToken) =>
        await db.CatalogEntries.Where(x => x.CampaignId == campaignId && x.Id == id && x.MetadataRevision == expectedRevision)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Name, name).SetProperty(x => x.IsHidden, isHidden).SetProperty(x => x.QuantityUnit, quantityUnit).SetProperty(x => x.AllowNegative, allowNegative).SetProperty(x => x.MetadataRevision, x => x.MetadataRevision + 1), cancellationToken) == 1;

    private static bool IsDuplicate(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
            if (current is MySqlException mysql && mysql.Number == 1062) return true;
        return false;
    }
}
