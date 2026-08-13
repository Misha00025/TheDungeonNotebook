using Microsoft.EntityFrameworkCore;
using Tdn.Settings;


namespace Tdn.Configuration;

public class ConfigParser
{	
	private string? _mongoConnectionString;
	private string? _settingsMongoDBName;
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
		_settingsMongoDBName = Environment.GetEnvironmentVariable("MONGO_SETTINGS_DATABASE");

		// Логируем строку подключения (без пароля)
		var maskedConn = _mysqlConnectionString != null 
			? System.Text.RegularExpressions.Regex.Replace(_mysqlConnectionString, "password=[^;]+", "password=***")
			: "null";
		Console.WriteLine($"[Config] MYSQL_CONNECTION_STRING: {maskedConn}");

		if (_mysqlConnectionString == null)
		{
			throw new Exception($"Can't find information to connect to databases:\n"+
									$" |-mysql:{_mysqlConnectionString}"
								);
		}
		
		if (_settingsMongoDBName == null)
			_settingsMongoDBName = "tdn-settings";
	}

	public void ConfigDbConnections(DbContextOptionsBuilder opt)
	{
		opt.UseMySql(Connection, new MySqlServerVersion(new Version(9, 0, 1)));
	}

	public MongoDbSettings? GetMongoDbSettings()
	{	
		if (_mongoConnectionString == null)
			return null;

		var settings = new MongoDbSettings
		{
			ConnectionString = _mongoConnectionString!,
			DatabaseName = _settingsMongoDBName!
		};
		return settings;
	}
}
