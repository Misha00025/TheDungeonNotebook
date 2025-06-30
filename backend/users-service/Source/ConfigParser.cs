using Microsoft.EntityFrameworkCore;


namespace Tdn.Configuration;

public class ConfigParser
{	
	private string? _databaseName;
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
		_databaseName = Environment.GetEnvironmentVariable("MYSQL_DATABASE");
		if (_mysqlConnectionString == null || _databaseName == null)
		{
			
			throw new Exception($"Can't find information to connect to databases:\n"+
									$" |-mysql:{_mysqlConnectionString}\n"+
									$" |-dbname: {_databaseName}"
								);
		}
	}

	public void ConfigDbConnections(DbContextOptionsBuilder opt)
	{
		opt.UseMySql(Connection, new MySqlServerVersion(new Version(9, 0, 1)));
	}
}