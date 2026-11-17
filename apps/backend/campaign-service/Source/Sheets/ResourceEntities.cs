using Tdn.Campaigns.Campaigns;

namespace Tdn.Campaigns.Sheets;

public sealed class TemplateMetadata
{
    public Guid Id { get; set; }
    public int CampaignId { get; set; }
    public Campaign? Campaign { get; set; }
    public required string Name { get; set; }
    public long MetadataRevision { get; set; } = 1;
}

public sealed class CharacterMetadata
{
    public Guid Id { get; set; }
    public int CampaignId { get; set; }
    public Campaign? Campaign { get; set; }
    public Guid TemplateId { get; set; }
    public TemplateMetadata? Template { get; set; }
    public required string Name { get; set; }
    public Importance Importance { get; set; } = Importance.Background;
    public long MetadataRevision { get; set; } = 1;
}

public sealed class CharacterAssignment
{
    public int CampaignId { get; set; }
    public Guid CharacterId { get; set; }
    public CharacterMetadata? Character { get; set; }
    public int UserId { get; set; }
    public CampaignMember? CampaignMember { get; set; }
    public bool CanWrite { get; set; }
    public long MetadataRevision { get; set; } = 1;
}

public sealed class FormulaMetadata
{
    public Guid Id { get; set; }
    public int CampaignId { get; set; }
    public Campaign? Campaign { get; set; }
    public required string Name { get; set; }
    public long MetadataRevision { get; set; } = 1;
}

public sealed class ViewMetadata
{
    public Guid Id { get; set; }
    public int CampaignId { get; set; }
    public Campaign? Campaign { get; set; }
    public required string Name { get; set; }
    public long MetadataRevision { get; set; } = 1;
}
