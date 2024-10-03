using Microsoft.EntityFrameworkCore;
using Tdn.Model.Db.Entities;


namespace Tdn.Model.Db.Contexts
{
	public class CharacterContext : DbContext
	{
		public CharacterContext(DbContextOptions<CharacterContext> options): base(options)
		{
		}
		
		protected override void OnModelCreating(ModelBuilder builder)
		{
			base.OnModelCreating(builder);

			var user = builder.Entity<UserData>();
			user.ToTable("user");
			user.Property(e => e.Id).HasColumnName("user_id");
			user.Property(e => e.FirstName).HasColumnName("first_name");
			user.Property(e => e.LastName).HasColumnName("last_name");
			user.Property(e => e.PhotoLink).HasColumnName("photo_link");
			
			var group = builder.Entity<GroupData>().ToTable("group");
			group.Property(e => e.Id).HasColumnName("group_id");
			group.Property(e => e.Name).HasColumnName("name");
			
			var ug = builder.Entity<UserGroupData>().ToTable("user_group");
			ug.Property(e => e.GroupId).HasColumnName("vk_group_id");
			ug.Property(e => e.UserId).HasColumnName("vk_user_id");
			ug.Property(e => e.Privileges).HasColumnName("is_admin");
			ug.HasKey(e => new {e.GroupId, e.UserId});
			ug.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
			ug.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
			
			var character = builder.Entity<CharacterData>().ToTable("character");
			character.Property(e => e.GroupId).HasColumnName("group_id");
			character.Property(e => e.Id).HasColumnName("character_id");
			character.Property(e => e.Name).HasColumnName("name");
			character.Property(e => e.Description).HasColumnName("description");
			character.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
			
			var inventory = builder.Entity<InventoryData>().ToTable("inventory");
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