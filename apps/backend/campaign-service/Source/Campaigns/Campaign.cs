using System.ComponentModel.DataAnnotations;
using Tdn.Campaigns.Access;
using Tdn.Campaigns.Sheets;

namespace Tdn.Campaigns.Campaigns;

public sealed class Campaign
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public long MetadataRevision { get; set; } = 1;
    public TemplateMetadata? Template { get; set; }
    public Guid CreationRequestId { get; set; }
    public SubjectType CreatedByType { get; set; }
    public int CreatedById { get; set; }
}

public sealed class CampaignMember
{
    public int CampaignId { get; set; }
    public Campaign? Campaign { get; set; }
    public int UserId { get; set; }
    public bool IsAdmin { get; set; }
    public long MetadataRevision { get; set; } = 1;
}

public sealed record CampaignDto(int Id, string Name, long MetadataRevision);
public sealed record CampaignMemberDto(int CampaignId, int UserId, bool IsAdmin, long MetadataRevision);
public sealed record CreationStatusDto(Guid RequestId, int ResourceId);

public sealed class CreateCampaignRequest
{
    [Required]
    public string? Name { get; init; }

    [Required]
    public Guid? RequestId { get; init; }

    public int? AdministratorUserId { get; init; }
}

public sealed class RenameCampaignRequest
{
    [Required]
    public string? Name { get; init; }

    [Required]
    [Range(1, long.MaxValue)]
    public long? ExpectedRevision { get; init; }
}

public sealed class UpsertCampaignMemberRequest
{
    [Required]
    public bool? IsAdmin { get; init; }

    [Required]
    [Range(0, long.MaxValue)]
    public long? ExpectedRevision { get; init; }
}
