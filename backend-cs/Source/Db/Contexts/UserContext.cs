using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Contexts;

public class UserContext : BaseDbContext
{
	public UserContext(DbContextOptions<CharacterContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
	{
	}

	protected override void OnModelCreating(ModelBuilder builder)
	{
		Configurer.ConfigureModel(builder.Entity<UserData>());
		Configurer.ConfigureModel(builder.Entity<UserCharacterData>());
		Configurer.ConfigureModel(builder.Entity<UserGroupData>());
		Configurer.ConfigureModel(builder.Entity<CharacterData>());
		Configurer.ConfigureModel(builder.Entity<GroupData>());
		base.OnModelCreating(builder);
	}
	
	public DbSet<UserData> Users => Set<UserData>();
	public DbSet<UserCharacterData> Characters => Set<UserCharacterData>();
	public DbSet<UserGroupData> Groups => Set<UserGroupData>();
}