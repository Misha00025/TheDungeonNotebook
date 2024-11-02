using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;


namespace TdnApi.Db.Contexts
{
	public class ItemsContext : DbContext
	{
		private IEntityBuildersConfigurer _configurer;
		public ItemsContext(DbContextOptions<CharacterContext> options, IEntityBuildersConfigurer configurer): base(options)
		{
			_configurer = configurer;
		}
		
		protected override void OnModelCreating(ModelBuilder builder)
		{
			base.OnModelCreating(builder);
			
			var character = builder.Entity<CharacterData>();
			_configurer.ConfigureModel(character);
			
			var inventory = builder.Entity<InventoryData>();
			inventory.ToTable("inventory");
			inventory.Property(e => e.Id).HasColumnName("inventory_id");
			inventory.Property(e => e.OwnerId).HasColumnName("owner_id");
			inventory.HasOne(e => e.Owner).WithMany().HasForeignKey(e => e.OwnerId);
			
			var item = builder.Entity<ItemData>().ToTable("item");
			item.Property(e => e.Id).HasColumnName("item_id");
			item.Property(e => e.GroupId).HasColumnName("group_id");
			item.Property(e => e.Name).HasColumnName("name");
			item.Property(e => e.Description).HasColumnName("description");
			item.Property(e => e.Image).HasColumnName("image_link");
			item.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
			
			var ii = builder.Entity<ItemInventoryData>().ToTable("inventory_item");
			ii.Property(e => e.ItemId).HasColumnName("item_id");
			ii.Property(e => e.InventoryId).HasColumnName("inventory_id");
			ii.Property(e => e.Amount).HasColumnName("amount");
			ii.HasKey(e => new {e.InventoryId, e.ItemId});
			ii.HasOne(e => e.Inventory).WithMany().HasForeignKey(e => e.InventoryId);
			ii.HasOne(e => e.Item).WithMany().HasForeignKey(e => e.ItemId);
		}
	}
}