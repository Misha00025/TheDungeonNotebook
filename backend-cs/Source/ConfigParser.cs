using Microsoft.EntityFrameworkCore;
using IniParser;
using IniParser.Model;


namespace TdnApi.Configuration;

public class ConfigParser
{

	public const string Connection = "server=localhost;port=3307;user=test_user;password=test-root;database=test_vk;"; 

	public ConfigParser(string filename){
		var parser = new FileIniDataParser();
		IniData data = parser.ReadFile(iniFilePath);

		// Получаем данные для авторизации
		string username = data["Authentication"]["Username"];
		string password = data["Authentication"]["Password"];
	}

	public void ConfigDbConnections(DbContextOptionsBuilder opt)
	{
		opt.UseMySql(Connection, new MySqlServerVersion(new Version(8, 0, 11)));
	}
}