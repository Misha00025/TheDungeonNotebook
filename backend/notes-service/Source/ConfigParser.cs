using Tdn.Settings;


namespace Tdn.Configuration;

public class ConfigParser
{	
	private string? _mongoConnectionString;
	private string? _mongoDBName;

	public ConfigParser(){
		_mongoConnectionString = Environment.GetEnvironmentVariable("MONGO_CONNECTION_STRING");
		_mongoDBName = Environment.GetEnvironmentVariable("MONGO_DATABASE");
		if (_mongoConnectionString == null || _mongoDBName == null)
		{
			throw new Exception($"Can't find information to connect to databases:\n"+
									$" |-mongo:{_mongoConnectionString}\n"+
									$" |-dbname: {_mongoDBName}"
								);
		}
	}
	
	public MongoDbSettings GetMongoDbSettings()
	{	
		string dbName;
		string connection;
		connection = _mongoConnectionString!;
		dbName = _mongoDBName!;
		var settings = new MongoDbSettings
		{
			ConnectionString = connection,
			DatabaseName = dbName
		};
		return settings;
	}
}