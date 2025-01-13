using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;
using TdnApi.Models.Db;

namespace TdnApi.Db.Contexts;

public class AppDbContext : BaseDbContext<AppDbContext>
{
	public AppDbContext(DbContextOptions<AppDbContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
	{
	}

	protected override void OnModelCreating(ModelBuilder builder)
	{
		Configurer.ConfigureModel(builder.Entity<UserData>());
		Configurer.ConfigureModel(builder.Entity<GroupData>());
		Configurer.ConfigureModel(builder.Entity<UserGroupData>());		
		TokensContext.Configure(builder);
		
		base.OnModelCreating(builder);
	}
}