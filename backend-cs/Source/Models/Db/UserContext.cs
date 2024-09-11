using Microsoft.EntityFrameworkCore;

namespace TdnApi.Models.Db;

public class UserContext : DbContext
{
	public UserContext(DbContextOptions<UserContext> options): base(options)
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
		
	}
	
	public DbSet<User> Users => Set<User>();
}