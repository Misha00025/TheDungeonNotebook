using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Entities;

namespace Tdn.Db.Contexts;

public class EntityContext : BaseDbContext<EntityContext>
{
	public EntityContext(DbContextOptions<EntityContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
	{
	}
	
	protected override void OnModelCreating(ModelBuilder builder)
	{
		Configurer.ConfigureModel(builder.Entity<GroupData>());
		Configurer.ConfigureModel(builder.Entity<ItemData>());
		Configurer.ConfigureModel(builder.Entity<CharlistTemplateData>());
		Configurer.ConfigureModel(builder.Entity<CharacterData>());
		base.OnModelCreating(builder);
	}
}