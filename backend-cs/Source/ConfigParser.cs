using Microsoft.EntityFrameworkCore;
using IniParser;
using IniParser.Model;


namespace TdnApi.Configuration;

public class ConfigParser
{
	private IniData _mainConfig;
	private IniData _dbConfig;

	public string Connection => GenerateConnection();

	public ConfigParser(string filename){
		var parser = new FileIniDataParser();
		_mainConfig = parser.ReadFile(filename);
		string dbFile = "configs/"+_mainConfig["DEFAULT"]["DbConnectionSettingsFile"];
		_dbConfig = parser.ReadFile(dbFile);
	}

	private string GenerateConnection()
	{
		var settings = _dbConfig["DATABASE"];
		string host = settings["Host"];
		string user = settings["User"];
		string pass = settings["Password"];
		string dbName = settings["DataBaseName"];
		string port = "";
		if (settings.ContainsKey("Port"))
			port = $"port={settings["Port"]};";
		
		string connection = $"server={host};{port}user={user};password={pass};database={dbName};";
		return connection;
	}

	public void ConfigDbConnections(DbContextOptionsBuilder opt)
	{		
		opt.UseMySql(Connection, new MySqlServerVersion(new Version(8, 0, 11)));
	}
}