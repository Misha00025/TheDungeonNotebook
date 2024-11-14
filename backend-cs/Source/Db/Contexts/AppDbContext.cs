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
		Configurer.ConfigureModel(builder.Entity<CharacterData>());
		Configurer.ConfigureModel(builder.Entity<UserGroupData>());		
		Configurer.ConfigureModel(builder.Entity<UserCharacterData>());
		Configurer.ConfigureModel(builder.Entity<InventoryData>());
		Configurer.ConfigureModel(builder.Entity<ItemData>());
		Configurer.ConfigureModel(builder.Entity<ItemInventoryData>());	
		Configurer.ConfigureModel(builder.Entity<NoteData>());
		TokensContext.Configure(builder);
		
		base.OnModelCreating(builder);
	}
}