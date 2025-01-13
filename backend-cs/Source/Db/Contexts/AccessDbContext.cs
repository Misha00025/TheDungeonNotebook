using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Contexts;

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
		Configurer.ConfigureModel(builder.Entity<NoteData>());		
				
		base.OnModelCreating(builder);
	}
	
	public DbSet<UserGroupData> UserGroups => Set<UserGroupData>();
}