using Microsoft.EntityFrameworkCore;


namespace TdnApi.Models.Db;

public class TokensContext : DbContext
{
	[Keyless]
	private class GroupToken { public string? Token; public string? Id; }
	[Keyless]
	private class UserToken { public string? Token; public string? Id; public DateTime LastDate; }
	
	public TokensContext(DbContextOptions<TokensContext> options): base(options)
	{
	}

	protected override void OnModelCreating(ModelBuilder builder)
	{
		var ut = builder.Entity<UserToken>().ToTable("vk_user_token");
		ut.Property(e => e.Token).HasColumnName("token");
		ut.Property(e => e.Id).HasColumnName("vk_user_id");
		ut.Property(e => e.LastDate).HasColumnName("last_date");
		
		var gt = builder.Entity<GroupToken>().ToTable("group_bot_token");
		gt.Property(e => e.Token).HasColumnName("service_token");
		gt.Property(e => e.Id).HasColumnName("group_id");
		
		base.OnModelCreating(builder);
	}


	private DbSet<UserToken> Users => Set<UserToken>();
	private DbSet<GroupToken> Groups => Set<GroupToken>();
	
	public string? GetUserId(string token)
	{
		var users = Users.Where(t => t.Token == token);
		if (users.Count() == 0)
			return null;
			
		return users.First().Id;
	}
	
	public string? GetGroupId(string token)
	{
		var groups = Groups.Where(t => t.Token == token);
		if (groups.Count() == 0)
			return null;
			
		return groups.First().Id;
	}
}
