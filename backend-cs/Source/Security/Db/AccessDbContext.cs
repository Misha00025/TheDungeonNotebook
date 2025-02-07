using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Security.Db;

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
		Configurer.ConfigureModel(builder.Entity<CharlistData>());		
		Configurer.ConfigureModel(builder.Entity<CharacterData>());		
				
		base.OnModelCreating(builder);
	}
	
	public DbSet<UserGroupData> UserGroups => Set<UserGroupData>();
	public DbSet<CharacterData> Characters => Set<CharacterData>();
}