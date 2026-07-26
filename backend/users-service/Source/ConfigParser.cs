using Microsoft.EntityFrameworkCore;


namespace Tdn.Configuration;

public class ConfigParser
{	
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
		_mysqlConnectionString = Environment.GetEnvironmentVariable("MYSQL_CONNECTION_STRING");

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
	}

	public void ConfigDbConnections(DbContextOptionsBuilder opt)
	{
		opt.UseMySql(Connection, new MySqlServerVersion(new Version(9, 0, 1)));
	}
}