using Microsoft.EntityFrameworkCore;
using IniParser;
using IniParser.Model;


namespace TdnApi.Configuration;

public class ConfigParser
{
	private const string DB = "DATABASE";
	private const string MySQL = "MySQL";
	
	private IniData _mainConfig;
	private IniData _dbConfig;

	private string? _connection = null;
	public string Connection { get 
		{
			if (_connection == null)
				_connection = GenerateConnection();
			return _connection;
		}
	}

	public ConfigParser(string filename){
		var parser = new FileIniDataParser();
		_mainConfig = parser.ReadFile(filename);
		string dbFile = "configs/"+_mainConfig["DEFAULT"]["DbConnectionSettingsFile"];
		_dbConfig = parser.ReadFile(dbFile);
	}

	private string GenerateConnection()
	{
		var settings = _dbConfig[DB];
		string host = settings["Host"];
		string user = settings["User"];
		string pass = settings["Password"];
		string dbName = settings["DataBaseName"];
		string port = "";
		if (settings.ContainsKey("Port"))
			port = $"port={settings["Port"]};";
		
		string connection = $"server={host};{port}user={user};password={pass};database={dbName};ConvertZeroDateTime=True;";
		return connection;
	}

	public void ConfigDbConnections(DbContextOptionsBuilder opt)
	{	
		string type = _dbConfig[DB]["Type"];
		Console.WriteLine(type);
		switch (type)
		{
			case MySQL:
				opt.UseMySql(Connection, new MySqlServerVersion(new Version(9, 0, 1)));
				break;
			default:
				opt.UseInMemoryDatabase("Test");
				break;
		}	
			
	}
}