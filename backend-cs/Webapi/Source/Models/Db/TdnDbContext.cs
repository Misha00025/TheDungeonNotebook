using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using TdnApi.Models;


namespace TdnApi.Models.Db;

public class TdnDbContext : DbContext
{	
	[Keyless]
	public class GroupUserData
	{
		public string GroupId = "";
		public string UserId = "";
		public bool IsAdmin;
		public Group? Group;
		public User? User;
	}
	
	public TdnDbContext(DbContextOptions<TdnDbContext> options): base(options)
	{
	}
	
	protected override void OnModelCreating(ModelBuilder builder)
	{
		base.OnModelCreating(builder);

		var user = builder.Entity<User>();
		user.ToTable("vk_user");
		user.Property(e => e.Id).HasColumnName("vk_user_id");
		user.Property(e => e.FirstName).HasColumnName("first_name");
		user.Property(e => e.LastName).HasColumnName("last_name");
		user.Property(e => e.PhotoLink).HasColumnName("photo_link");
		
		var group = builder.Entity<Group>().ToTable("vk_group");
		group.Property(e => e.Id).HasColumnName("vk_group_id");
		group.Property(e => e.Name).HasColumnName("group_name");
		
		var ug = builder.Entity<GroupUserData>().ToTable("user_group");
		ug.Property(e => e.GroupId).HasColumnName("vk_group_id");
		ug.Property(e => e.UserId).HasColumnName("vk_user_id");
		ug.Property(e => e.IsAdmin).HasColumnName("is_admin");
		ug.HasKey(e => new {e.GroupId, e.UserId});
		ug.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
		ug.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
		
		var note = builder.Entity<Note>().ToTable("note");
		note.Property(e => e.GroupId).HasColumnName("group_id");
		note.Property(e => e.OwnerId).HasColumnName("owner_id");
		note.Property(e => e.Id).HasColumnName("note_id");
		note.Property(e => e.Header).HasColumnName("header");
		note.Property(e => e.Body).HasColumnName("description");
		note.Property(e => e.AdditionDate).HasColumnName("addition_date");
		note.Property(e => e.ModifiedDate).HasColumnName("modified_date");
		note.HasKey(e => new {e.GroupId, e.OwnerId});
		note.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
		note.HasOne(e => e.Owner).WithMany().HasForeignKey(e => e.OwnerId);
		
		var character = builder.Entity<Character>().ToTable("character");
		character.Property(e => e.GroupId).HasColumnName("group_id");
		character.Property(e => e.OwnerId).HasColumnName("owner_id");
		character.Property(e => e.Id).HasColumnName("character_id");
		character.Property(e => e.Name).HasColumnName("name");
		character.Property(e => e.Description).HasColumnName("description");
		character.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
		character.HasOne(e => e.Owner).WithMany().HasForeignKey(e => e.OwnerId);
		
		var inventory = builder.Entity<Inventory>().ToTable("inventory");
		inventory.Property(e => e.Id).HasColumnName("inventory_id");
		inventory.Property(e => e.OwnerId).HasColumnName("owner_id");
		inventory.HasOne(e => e.Owner).WithMany().HasForeignKey(e => e.OwnerId);
		
		var item = builder.Entity<Item>().ToTable("item");
		item.Property(e => e.Id).HasColumnName("item_id");
		item.Property(e => e.GroupId).HasColumnName("group_id");
		item.Property(e => e.Name).HasColumnName("name");
		item.Property(e => e.Description).HasColumnName("description");
		item.Property(e => e.Image).HasColumnName("image_link");
		item.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
		
		var ii = builder.Entity<InventoryItem>().ToTable("inventory_item");
		ii.Property(e => e.ItemId).HasColumnName("item_id");
		ii.Property(e => e.InventoryId).HasColumnName("inventory_id");
		ii.Property(e => e.Amount).HasColumnName("amount");
		ii.HasOne(e => e.Inventory).WithMany().HasForeignKey(e => e.InventoryId);
		ii.HasOne(e => e.Item).WithMany().HasForeignKey(e => e.ItemId);
	}
	
	public DbSet<User> Users => Set<User>();
	public DbSet<Group> Groups => Set<Group>();
	public DbSet<GroupUserData> UserGroups => Set<GroupUserData>();
	public DbSet<Note> Notes => Set<Note>();
	public DbSet<Character> Characters => Set<Character>();
	public DbSet<Inventory> Inventories => Set<Inventory>();
	public DbSet<Item> Items => Set<Item>();
	public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
}