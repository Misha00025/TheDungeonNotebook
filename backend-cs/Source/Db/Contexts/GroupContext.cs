using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Contexts;

public class GroupContext : BaseDbContext
{
	public GroupContext(DbContextOptions<CharacterContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
	{
	}
	
	protected override void OnModelCreating(ModelBuilder builder)
	{
		Configurer.ConfigureModel(builder.Entity<GroupData>());
		Configurer.ConfigureModel(builder.Entity<CharacterData>());
		Configurer.ConfigureModel(builder.Entity<UserData>());
		Configurer.ConfigureModel(builder.Entity<UserGroupData>());
		Configurer.ConfigureModel(builder.Entity<UserCharacterData>());
		Configurer.ConfigureModel(builder.Entity<ItemData>());
		base.OnModelCreating(builder);
	}
	public DbSet<GroupData> Groups => Set<GroupData>();
	public DbSet<UserGroupData> Users => Set<UserGroupData>();
	public DbSet<CharacterData> Characters => Set<CharacterData>();
	public DbSet<UserCharacterData> UserCharacters => Set<UserCharacterData>();
	public DbSet<ItemData> Items => Set<ItemData>();
	
}