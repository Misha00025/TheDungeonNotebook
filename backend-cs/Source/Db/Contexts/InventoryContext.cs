using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;


namespace TdnApi.Db.Contexts
{
	public class InventoryContext : BaseDbContext
	{
        public InventoryContext(DbContextOptions<CharacterContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
        {
        }

        protected override void OnModelCreating(ModelBuilder builder)
		{
			base.OnModelCreating(builder);
			
			Configurer.ConfigureModel(builder.Entity<CharacterData>());
			Configurer.ConfigureModel(builder.Entity<InventoryData>());
			Configurer.ConfigureModel(builder.Entity<ItemData>());
			Configurer.ConfigureModel(builder.Entity<ItemInventoryData>());
		}
		
		public DbSet<InventoryData> Inventories => Set<InventoryData>();
		public DbSet<ItemInventoryData> Items => Set<ItemInventoryData>();
	}
}