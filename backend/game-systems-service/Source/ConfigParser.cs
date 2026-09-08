using Microsoft.EntityFrameworkCore;
using Tdn.Settings;

namespace Tdn.Configuration;

public class ConfigParser
{
    private string? _mongoConnectionString;
    private string? _mongoDBName;
    private string? _mysqlConnectionString;

    private string? _connection = null;
    public string Connection
    {
        get
        {
            if (_connection == null)
                _connection = _mysqlConnectionString!;
            return _connection;
        }
    }

    public ConfigParser()
    {
        _mongoConnectionString = Environment.GetEnvironmentVariable("MONGO_CONNECTION_STRING");
        _mysqlConnectionString = Environment.GetEnvironmentVariable("MYSQL_CONNECTION_STRING");
        _mongoDBName = Environment.GetEnvironmentVariable("MONGO_DATABASE");

        // Логируем строку подключения (без пароля)
        var maskedConn = _mysqlConnectionString != null
            ? System.Text.RegularExpressions.Regex.Replace(_mysqlConnectionString, "password=[^;]+", "password=***")
            : "null";
        Console.WriteLine($"[Config] MYSQL_CONNECTION_STRING: {maskedConn}");

        if (_mongoConnectionString == null || _mysqlConnectionString == null)
        {
            throw new Exception($"Can't find information to connect to databases:\n" +
                                $" |-mongo:{_mongoConnectionString}\n" +
                                $" |-mysql:{_mysqlConnectionString}");
        }
        if (_mongoDBName == null)
            _mongoDBName = "tdn-game-systems";
    }

    public void ConfigDbConnections(DbContextOptionsBuilder opt)
    {
        opt.UseMySql(Connection, new MySqlServerVersion(new Version(9, 0, 1)));
    }

    public MongoDbSettings GetMongoDbSettings()
    {
        return new MongoDbSettings
        {
            ConnectionString = _mongoConnectionString!,
            DatabaseName = _mongoDBName!
        };
    }
}
