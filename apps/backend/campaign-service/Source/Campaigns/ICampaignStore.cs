namespace Tdn.Campaigns.Campaigns;

public interface ICampaignStore
{
    Task<Campaign?> GetCampaignAsync(int campaignId, CancellationToken cancellationToken);
    Task<IReadOnlyList<Campaign>> GetAllCampaignsAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<Campaign>> GetCampaignsForUserAsync(int userId, CancellationToken cancellationToken);
    Task<Campaign?> GetCampaignForUserAsync(int campaignId, int userId, CancellationToken cancellationToken);
    Task<Campaign?> GetCampaignByRequestAsync(Guid requestId, CancellationToken cancellationToken);
    Task<CampaignMember?> GetMemberAsync(int campaignId, int userId, CancellationToken cancellationToken);
    Task<IReadOnlyList<CampaignMember>> GetMembersAsync(int campaignId, CancellationToken cancellationToken);
    Task<Campaign> CreateAsync(Campaign campaign, int administratorUserId, CancellationToken cancellationToken);
    Task<bool> RenameAsync(int campaignId, string name, long expectedRevision, CancellationToken cancellationToken);
    Task<MemberUpdateResult> UpsertMemberAsync(int campaignId, int userId, bool isAdmin, long expectedRevision, CancellationToken cancellationToken);
    Task<bool> DeleteMemberAsync(int campaignId, int userId, long expectedRevision, CancellationToken cancellationToken);
}

public sealed record MemberUpdateResult(long? Revision, bool Exists);
