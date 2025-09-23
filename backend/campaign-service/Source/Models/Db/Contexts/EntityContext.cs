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
		Configurer.ConfigureModel(builder.Entity<CharlistData>());
		Configurer.ConfigureModel(builder.Entity<CharacterData>());
		Configurer.ConfigureModel(builder.Entity<SkillData>());
		Configurer.ConfigureModel(builder.Entity<CharacterSkillData>());
		base.OnModelCreating(builder);
	}
}