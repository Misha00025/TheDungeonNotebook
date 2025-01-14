using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Entities;

namespace Tdn.Db.Contexts;

public class AccessDbContext : BaseDbContext<AccessDbContext>
{
	public AccessDbContext(DbContextOptions<AccessDbContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
	{
	}

	protected override void OnModelCreating(ModelBuilder builder)
	{
		Configurer.ConfigureModel(builder.Entity<UserData>());
		Configurer.ConfigureModel(builder.Entity<GroupData>());
		Configurer.ConfigureModel(builder.Entity<UserGroupData>());		
				
		base.OnModelCreating(builder);
	}
	
	public DbSet<UserGroupData> UserGroups => Set<UserGroupData>();
}