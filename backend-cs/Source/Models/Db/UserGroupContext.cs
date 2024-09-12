using Microsoft.EntityFrameworkCore;

namespace TdnApi.Models.Db;

public class UserGroupContext : DbContext
{
	[Keyless]
	public class UserData 
	{	
		public string? Id { get; set; }
		public string? FirstName { get; set; }
		public string? LastName { get; set; }
		public string? PhotoLink { get; set; }
	}
	
	[Keyless]
	public class GroupData
	{
		public string? Id { get; set; }
		public string? Name { get; set; }
	}
	
	[Keyless]
	public class GroupUserData
	{
		public string? GroupId;
		public string? UserId;
		public bool IsAdmin;
	}
	
	public UserGroupContext(DbContextOptions<UserGroupContext> options): base(options)
	{
	}
	
	protected override void OnModelCreating(ModelBuilder builder)
	{
		base.OnModelCreating(builder);

		var user = builder.Entity<UserData>();
		user.ToTable("vk_user");
		user.Property(e => e.Id).HasColumnName("vk_user_id");
		user.Property(e => e.FirstName).HasColumnName("first_name");
		user.Property(e => e.LastName).HasColumnName("last_name");
		user.Property(e => e.PhotoLink).HasColumnName("photo_link");
		
		var group = builder.Entity<GroupData>().ToTable("vk_group");
		group.Property(e => e.Id).HasColumnName("vk_group_id");
		group.Property(e => e.Name).HasColumnName("group_name");
		
		var ug = builder.Entity<GroupUserData>().ToTable("user_group");
		ug.Property(e => e.GroupId).HasColumnName("vk_group_id");
		ug.Property(e => e.UserId).HasColumnName("vk_user_id");
		ug.Property(e => e.IsAdmin).HasColumnName("is_admin");
	}
	
	public DbSet<UserData> Users => Set<UserData>();
	public DbSet<GroupData> Groups => Set<GroupData>();
	public DbSet<GroupUserData> UserGroups => Set<GroupUserData>();
}