using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;

namespace Tdn.Db.Contexts;

public abstract class BaseDbContext<T> : DbContext where T : BaseDbContext<T>
{
	private IEntityBuildersConfigurer _configurer;
	
	public BaseDbContext(DbContextOptions<T> options, IEntityBuildersConfigurer configurer): base(options)
	{
		_configurer = configurer;
	}
	
	protected IEntityBuildersConfigurer Configurer => _configurer;
}