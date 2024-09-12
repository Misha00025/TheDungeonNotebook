using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using TdnApi.Models;


namespace TdnApi.Models.Db;

public class UserGroupContext : DbContext
{	
	[Keyless]
	public class GroupUserData
	{
		public string? GroupId;
		public string? UserId;
		public bool IsAdmin;
		public Group? Group;
		public User? User;
	}
	
	public UserGroupContext(DbContextOptions<UserGroupContext> options): base(options)
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
	}
	
	public DbSet<User> Users => Set<User>();
	public DbSet<Group> Groups => Set<Group>();
	public DbSet<GroupUserData> UserGroups => Set<GroupUserData>();
}