namespace Tdn.Campaigns.Configuration;

public sealed class CampaignDatabaseOptions
{
    public string ConnectionString { get; set; } = string.Empty;
    public string ServerVersion { get; set; } = "8.0.36";
    public bool ApplyMigrations { get; set; } = true;
}
