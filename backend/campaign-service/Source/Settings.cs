namespace Tdn.Settings;

public abstract class MongoDbSettingsBase
{
    public string ConnectionString { get; set; } = null!;
    public string DatabaseName { get; set; } = null!;
}

public class MongoDbSettings : MongoDbSettingsBase { }

public class SchemasMongoDbSettings : MongoDbSettingsBase { }
