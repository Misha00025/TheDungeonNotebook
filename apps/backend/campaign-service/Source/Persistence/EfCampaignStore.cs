using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Campaigns;

namespace Tdn.Campaigns.Persistence;

public sealed class EfCampaignStore(CampaignDbContext db) : ICampaignStore
{
    public Task<Campaign?> GetCampaignAsync(int campaignId, CancellationToken cancellationToken) =>
        db.Campaigns.AsNoTracking().SingleOrDefaultAsync(x => x.Id == campaignId, cancellationToken);

    public async Task<IReadOnlyList<Campaign>> GetAllCampaignsAsync(CancellationToken cancellationToken) =>
        await db.Campaigns.AsNoTracking().OrderBy(x => x.Id).ToArrayAsync(cancellationToken);

    public async Task<IReadOnlyList<Campaign>> GetCampaignsForUserAsync(int userId, CancellationToken cancellationToken) =>
        await (from campaign in db.Campaigns.AsNoTracking()
               join member in db.CampaignMembers.AsNoTracking() on campaign.Id equals member.CampaignId
               where member.UserId == userId
               orderby campaign.Id
               select campaign).ToArrayAsync(cancellationToken);

    public Task<Campaign?> GetCampaignForUserAsync(int campaignId, int userId, CancellationToken cancellationToken) =>
        (from campaign in db.Campaigns.AsNoTracking()
         join member in db.CampaignMembers.AsNoTracking() on campaign.Id equals member.CampaignId
         where campaign.Id == campaignId && member.UserId == userId
         select campaign).SingleOrDefaultAsync(cancellationToken);

    public Task<Campaign?> GetCampaignByRequestAsync(Guid requestId, CancellationToken cancellationToken) =>
        db.Campaigns.AsNoTracking().SingleOrDefaultAsync(x => x.CreationRequestId == requestId, cancellationToken);

    public Task<CampaignMember?> GetMemberAsync(int campaignId, int userId, CancellationToken cancellationToken) =>
        db.CampaignMembers.AsNoTracking().SingleOrDefaultAsync(x => x.CampaignId == campaignId && x.UserId == userId, cancellationToken);

    public async Task<IReadOnlyList<CampaignMember>> GetMembersAsync(int campaignId, CancellationToken cancellationToken) =>
        await db.CampaignMembers.AsNoTracking().Where(x => x.CampaignId == campaignId).OrderBy(x => x.UserId).ToArrayAsync(cancellationToken);

    public async Task<Campaign> CreateAsync(Campaign campaign, int administratorUserId, CancellationToken cancellationToken)
    {
        db.Campaigns.Add(campaign);
        db.CampaignMembers.Add(new CampaignMember { Campaign = campaign, UserId = administratorUserId, IsAdmin = true });
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return campaign;
        }
        catch (DbUpdateException exception) when (IsMySqlDuplicate(exception))
        {
            db.ChangeTracker.Clear();
            throw new DuplicateCreationRequestException();
        }
        catch (OperationCanceledException)
        {
            db.ChangeTracker.Clear();
            throw;
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            throw new CampaignStoreException(true);
        }
        catch (DbException)
        {
            db.ChangeTracker.Clear();
            throw new CampaignStoreException(true);
        }
    }

    public async Task<bool> RenameAsync(int campaignId, string name, long expectedRevision, CancellationToken cancellationToken)
    {
        return await ExecuteWriteAsync(async () =>
        {
            var affected = await db.Campaigns.Where(x => x.Id == campaignId && x.MetadataRevision == expectedRevision)
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Name, name).SetProperty(x => x.MetadataRevision, x => x.MetadataRevision + 1), cancellationToken);
            return affected == 1;
        });
    }

    public async Task<MemberUpdateResult> UpsertMemberAsync(int campaignId, int userId, bool isAdmin, long expectedRevision, CancellationToken cancellationToken)
    {
        if (expectedRevision == 0)
        {
            db.CampaignMembers.Add(new CampaignMember { CampaignId = campaignId, UserId = userId, IsAdmin = isAdmin, MetadataRevision = 1 });
            try
            {
                await db.SaveChangesAsync(cancellationToken);
                return new MemberUpdateResult(1, true);
            }
            catch (DbUpdateException exception) when (IsMySqlDuplicate(exception))
            {
                db.ChangeTracker.Clear();
                return new MemberUpdateResult(null, true);
            }
            catch (OperationCanceledException)
            {
                db.ChangeTracker.Clear();
                throw;
            }
            catch (DbUpdateException)
            {
                db.ChangeTracker.Clear();
                throw new CampaignStoreException(true);
            }
            catch (DbException)
            {
                db.ChangeTracker.Clear();
                throw new CampaignStoreException(true);
            }
        }

        var affected = await ExecuteWriteAsync(() => db.CampaignMembers.Where(x => x.CampaignId == campaignId && x.UserId == userId && x.MetadataRevision == expectedRevision)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.IsAdmin, isAdmin).SetProperty(x => x.MetadataRevision, x => x.MetadataRevision + 1), cancellationToken));
        if (affected == 1)
            return new MemberUpdateResult(expectedRevision + 1, true);
        var exists = await db.CampaignMembers.AnyAsync(x => x.CampaignId == campaignId && x.UserId == userId, cancellationToken);
        return new MemberUpdateResult(null, exists);
    }

    public async Task<bool> DeleteMemberAsync(int campaignId, int userId, long expectedRevision, CancellationToken cancellationToken)
    {
        try
        {
            return await db.CampaignMembers.Where(x => x.CampaignId == campaignId && x.UserId == userId && x.MetadataRevision == expectedRevision)
                .ExecuteDeleteAsync(cancellationToken) == 1;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (DbUpdateException exception) when (HasMySqlError(exception, 1451))
        {
            throw MemberHasAssignments(campaignId);
        }
        catch (DbException exception) when (HasMySqlError(exception, 1451))
        {
            throw MemberHasAssignments(campaignId);
        }
        catch (DbUpdateException)
        {
            throw new CampaignStoreException(true);
        }
        catch (DbException)
        {
            throw new CampaignStoreException(true);
        }
    }

    private static async Task<T> ExecuteWriteAsync<T>(Func<Task<T>> action)
    {
        try
        {
            return await action();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (DbUpdateException)
        {
            throw new CampaignStoreException(true);
        }
        catch (DbException)
        {
            throw new CampaignStoreException(true);
        }
    }

    private static bool IsMySqlDuplicate(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is MySqlException mysql && mysql.Number == 1062)
                return true;
        }
        return false;
    }

    private static bool HasMySqlError(Exception exception, int number)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is MySqlException mysql && mysql.Number == number)
                return true;
        }
        return false;
    }

    private static DomainException MemberHasAssignments(int campaignId) =>
        new(409, "member_has_assignments", "The campaign member still has restrictive references.", campaignId);
}

public sealed class CampaignStoreException(bool writeOutcomeUnknown) : Exception("The campaign write outcome could not be confirmed.")
{
    public bool WriteOutcomeUnknown { get; } = writeOutcomeUnknown;
}
