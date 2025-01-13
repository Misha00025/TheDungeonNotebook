using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Contexts;

public class GroupContext : BaseDbContext<GroupContext>
{
	public GroupContext(DbContextOptions<GroupContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
	{
	}
	
	protected override void OnModelCreating(ModelBuilder builder)
	{
		Configurer.ConfigureModel(builder.Entity<GroupData>());
		Configurer.ConfigureModel(builder.Entity<UserData>());
		Configurer.ConfigureModel(builder.Entity<UserGroupData>());
		base.OnModelCreating(builder);
	}
	public DbSet<GroupData> Groups => Set<GroupData>();
	public DbSet<UserGroupData> Users => Set<UserGroupData>();
	
}