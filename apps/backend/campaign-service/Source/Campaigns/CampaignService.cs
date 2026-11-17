using Tdn.Campaigns.Access;

namespace Tdn.Campaigns.Campaigns;

public sealed class CampaignService(ICampaignStore store)
{
    public async Task<CampaignDto> CreateAsync(Subject? subject, CreateCampaignRequest request, CancellationToken cancellationToken)
    {
        var current = RequireSubject(subject);
        if (string.IsNullOrWhiteSpace(request.Name))
            throw BadRequest("invalid_name", "A non-whitespace campaign name is required.");
        if (request.RequestId is null || request.RequestId == Guid.Empty)
            throw BadRequest("invalid_request_id", "A non-empty requestId is required.");

        int administratorUserId;
        switch (current.Type)
        {
            case SubjectType.User:
                administratorUserId = request.AdministratorUserId ?? current.Id;
                if (administratorUserId != current.Id)
                    throw Forbidden();
                break;
            case SubjectType.Admin:
                if (request.AdministratorUserId is null)
                    throw BadRequest("administrator_required", "administratorUserId is required for an Admin subject.");
                administratorUserId = request.AdministratorUserId.Value;
                break;
            default:
                throw Forbidden();
        }

        var entity = new Campaign
        {
            Name = request.Name,
            CreationRequestId = request.RequestId.Value,
            CreatedByType = current.Type,
            CreatedById = current.Id
        };

        try
        {
            var created = await store.CreateAsync(entity, administratorUserId, cancellationToken);
            return ToDto(created);
        }
        catch (DuplicateCreationRequestException)
        {
            var existing = await store.GetCampaignByRequestAsync(request.RequestId.Value, cancellationToken);
            if (existing is null)
                throw ServiceUnavailable();
            if (current.Type != SubjectType.Admin && (existing.CreatedByType != current.Type || existing.CreatedById != current.Id))
                throw Forbidden();
            throw new DomainException(409, "creation_already_published", "The creation request has already been published.", existing.Id, request.RequestId.Value);
        }
    }

    public async Task<IReadOnlyList<CampaignDto>> ListAsync(Subject? subject, CancellationToken cancellationToken)
    {
        var current = RequireSubject(subject);
        IReadOnlyList<Campaign> campaigns = current.Type switch
        {
            SubjectType.Admin => await store.GetAllCampaignsAsync(cancellationToken),
            SubjectType.User => await store.GetCampaignsForUserAsync(current.Id, cancellationToken),
            _ => throw Forbidden()
        };
        return campaigns.Select(ToDto).ToArray();
    }

    public async Task<CreationStatusDto> GetCreationStatusAsync(Subject? subject, Guid requestId, CancellationToken cancellationToken)
    {
        var current = RequireSubject(subject);
        if (current.Type == SubjectType.Group)
            throw Forbidden();
        var campaign = await store.GetCampaignByRequestAsync(requestId, cancellationToken);
        if (campaign is null)
            throw NotFound();
        if (current.Type == SubjectType.User && await store.GetMemberAsync(campaign.Id, current.Id, cancellationToken) is null)
            throw NotFound();
        if (current.Type != SubjectType.Admin && (campaign.CreatedByType != SubjectType.User || campaign.CreatedById != current.Id))
            throw Forbidden();
        return new CreationStatusDto(requestId, campaign.Id);
    }

    public async Task<CampaignDto> GetAsync(Subject? subject, int campaignId, CancellationToken cancellationToken)
    {
        var current = RequireSubject(subject);
        var campaign = await store.GetCampaignAsync(campaignId, cancellationToken);
        if (campaign is null)
            throw NotFound();
        await RequireCampaignAccessAsync(current, campaignId, cancellationToken);
        return ToDto(campaign);
    }

    public async Task<CampaignDto> RenameAsync(Subject? subject, int campaignId, RenameCampaignRequest request, CancellationToken cancellationToken)
    {
        var current = RequireSubject(subject);
        if (string.IsNullOrWhiteSpace(request.Name))
            throw BadRequest("invalid_name", "A non-whitespace campaign name is required.");
        if (request.ExpectedRevision is null || request.ExpectedRevision < 1)
            throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
        var campaign = await RequireCampaignAdminAsync(current, campaignId, cancellationToken);
        if (!await store.RenameAsync(campaignId, request.Name, request.ExpectedRevision.Value, cancellationToken))
        {
            if (await store.GetCampaignAsync(campaignId, cancellationToken) is null)
                throw NotFound();
            throw Conflict("revision_conflict", "The campaign revision no longer matches.", campaignId);
        }
        return new CampaignDto(campaign.Id, request.Name, request.ExpectedRevision.Value + 1);
    }

    public async Task<IReadOnlyList<CampaignMemberDto>> ListMembersAsync(Subject? subject, int campaignId, CancellationToken cancellationToken)
    {
        var current = RequireSubject(subject);
        await RequireCampaignAdminAsync(current, campaignId, cancellationToken);
        return (await store.GetMembersAsync(campaignId, cancellationToken)).Select(ToDto).ToArray();
    }

    public async Task<(CampaignMemberDto Member, bool Created)> UpsertMemberAsync(Subject? subject, int campaignId, int userId, UpsertCampaignMemberRequest request, CancellationToken cancellationToken)
    {
        var current = RequireSubject(subject);
        if (request.IsAdmin is null)
            throw BadRequest("invalid_member", "isAdmin is required.");
        if (request.ExpectedRevision is null || request.ExpectedRevision < 0)
            throw BadRequest("invalid_revision", "expectedRevision must be zero or greater.");
        await RequireCampaignAdminAsync(current, campaignId, cancellationToken);
        var result = await store.UpsertMemberAsync(campaignId, userId, request.IsAdmin.Value, request.ExpectedRevision.Value, cancellationToken);
        if (result.Revision is null)
        {
            if (request.ExpectedRevision.Value > 0 && !result.Exists)
                throw NotFound();
            throw Conflict(request.ExpectedRevision.Value == 0 ? "member_already_exists" : "revision_conflict", "The campaign member revision no longer matches.", campaignId);
        }
        return (new CampaignMemberDto(campaignId, userId, request.IsAdmin.Value, result.Revision.Value), request.ExpectedRevision.Value == 0);
    }

    public async Task DeleteMemberAsync(Subject? subject, int campaignId, int userId, long expectedRevision, CancellationToken cancellationToken)
    {
        var current = RequireSubject(subject);
        if (expectedRevision < 1)
            throw BadRequest("invalid_revision", "expectedRevision must be at least 1.");
        await RequireCampaignAdminAsync(current, campaignId, cancellationToken);
        var deleted = await store.DeleteMemberAsync(campaignId, userId, expectedRevision, cancellationToken);
        if (!deleted)
        {
            if (await store.GetMemberAsync(campaignId, userId, cancellationToken) is null)
                throw NotFound();
            throw Conflict("revision_conflict", "The member revision no longer matches.", campaignId);
        }
    }

    private async Task<Campaign> RequireCampaignAdminAsync(Subject subject, int campaignId, CancellationToken cancellationToken)
    {
        var campaign = await store.GetCampaignAsync(campaignId, cancellationToken);
        if (campaign is null)
            throw NotFound();
        if (subject.Type == SubjectType.Admin || subject.Type == SubjectType.Group && subject.Id == campaignId)
            return campaign;
        if (subject.Type != SubjectType.User)
            throw NotFound();
        var member = await store.GetMemberAsync(campaignId, subject.Id, cancellationToken);
        if (member is null)
            throw NotFound();
        if (!member.IsAdmin)
            throw Forbidden();
        return campaign;
    }

    private async Task RequireCampaignAccessAsync(Subject subject, int campaignId, CancellationToken cancellationToken)
    {
        if (subject.Type == SubjectType.Admin || subject.Type == SubjectType.Group && subject.Id == campaignId)
            return;
        if (subject.Type != SubjectType.User || await store.GetMemberAsync(campaignId, subject.Id, cancellationToken) is null)
            throw NotFound();
    }

    private static Subject RequireSubject(Subject? subject)
    {
        if (subject is null || subject.Type is not (SubjectType.User or SubjectType.Group or SubjectType.Admin))
            throw Forbidden();
        return subject;
    }
    private static CampaignDto ToDto(Campaign campaign) => new(campaign.Id, campaign.Name, campaign.MetadataRevision);
    private static CampaignMemberDto ToDto(CampaignMember member) => new(member.CampaignId, member.UserId, member.IsAdmin, member.MetadataRevision);
    private static DomainException Forbidden() => new(403, "forbidden", "The operation is not permitted.");
    private static DomainException NotFound() => new(404, "not_found", "The requested resource was not found.");
    private static DomainException BadRequest(string code, string message) => new(400, code, message);
    private static DomainException Conflict(string code, string message, int resourceId) => new(409, code, message, resourceId);
    private static DomainException ServiceUnavailable() => new(503, "dependency_unavailable", "The campaign store is temporarily unavailable.");
}

public sealed class DuplicateCreationRequestException : Exception
{
}
