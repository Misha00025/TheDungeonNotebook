namespace Tdn.Campaigns.Configuration;

public sealed class SheetOptions
{
    public string DefaultImportance { get; set; } = "background";
    public bool MembersCanReadDefinitions { get; set; } = true;
}

public sealed class MongoOptions
{
    public string ConnectionString { get; set; } = string.Empty;
    public string Database { get; set; } = string.Empty;
}
