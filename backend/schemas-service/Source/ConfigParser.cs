using Tdn.Settings;


namespace Tdn.Configuration;

public class ConfigParser
{	
	private string? _mongoConnectionString;
	private string? _databaseName;
	private string? _mongoDBName;
	private string? _mysqlConnectionString;
	
	private string? _connection = null;
	public string Connection { get 
		{
			if (_connection == null)
				_connection = _mysqlConnectionString!;
			return _connection;
		}
	}

	public ConfigParser(){
		_mongoConnectionString = Environment.GetEnvironmentVariable("MONGO_CONNECTION_STRING");
		_mysqlConnectionString = Environment.GetEnvironmentVariable("MYSQL_CONNECTION_STRING");
		_databaseName = Environment.GetEnvironmentVariable("MYSQL_DATABASE");
		_mongoDBName = Environment.GetEnvironmentVariable("MONGO_DATABASE");
		if (_mongoConnectionString == null || _mysqlConnectionString == null || _databaseName == null)
		{
			throw new Exception($"Can't find information to connect to databases:\n"+
									$" |-mongo:{_mongoConnectionString}\n"+
									$" |-mysql:{_mysqlConnectionString}\n"+
									$" |-dbname: {_databaseName}"
								);
		}
		if (_mongoDBName == null)
			_mongoDBName = _databaseName;
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