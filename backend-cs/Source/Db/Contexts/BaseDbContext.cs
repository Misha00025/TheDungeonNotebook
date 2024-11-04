using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;

namespace TdnApi.Db.Contexts;

public abstract class BaseDbContext : DbContext
{
	private IEntityBuildersConfigurer _configurer;
	
	public BaseDbContext(DbContextOptions<CharacterContext> options, IEntityBuildersConfigurer configurer): base(options)
	{
		_configurer = configurer;
	}
	
	protected IEntityBuildersConfigurer Configurer => _configurer;
}