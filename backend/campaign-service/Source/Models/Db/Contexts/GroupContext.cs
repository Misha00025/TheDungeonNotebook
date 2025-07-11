using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Entities;

namespace Tdn.Db.Contexts;

public class GroupContext : BaseDbContext<GroupContext>
{
	public GroupContext(DbContextOptions<GroupContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
	{
	}
	
	protected override void OnModelCreating(ModelBuilder builder)
	{
		Configurer.ConfigureModel(builder.Entity<GroupData>());
		base.OnModelCreating(builder);
	}
	public DbSet<GroupData> Groups => Set<GroupData>();
}