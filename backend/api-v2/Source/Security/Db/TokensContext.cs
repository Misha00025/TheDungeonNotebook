using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;


namespace Tdn.Security.Db;

public class TokensContext : BaseDbContext<TokensContext>
{
	public TokensContext(DbContextOptions<TokensContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
	{
	}

	private class GroupToken { public string Token = ""; public int Id; public GroupData? Group;}
	private class UserToken { public string Token = ""; public int Id; public DateTime LastDate = DateTime.Now; public UserData? User;}
	

	protected override void OnModelCreating(ModelBuilder builder)
	{
		this.Configurer.ConfigureModel(builder.Entity<UserData>());
		this.Configurer.ConfigureModel(builder.Entity<GroupData>());
		
		TokensContext.Configure(builder);
		
		base.OnModelCreating(builder);
	}

	public static void Configure(ModelBuilder builder)
	{
		var ut = builder.Entity<UserToken>().ToTable("user_token");
		ut.Property(e => e.Token).HasColumnName("token");
		ut.Property(e => e.Id).HasColumnName("user_id");
		ut.Property(e => e.LastDate).HasColumnName("last_date");
		ut.HasKey(e => e.Token);
		ut.HasOne(e => e.User).WithMany().HasForeignKey(e => e.Id);
		
		
		var gt = builder.Entity<GroupToken>().ToTable("group_bot_token");
		gt.Property(e => e.Token).HasColumnName("service_token");
		gt.Property(e => e.Id).HasColumnName("group_id");
		gt.HasKey(e => e.Token);
		gt.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.Id);
	}

	private DbSet<UserToken> Users => Set<UserToken>();
	private DbSet<GroupToken> Groups => Set<GroupToken>();
	
	public int? GetUserId(string token)
	{
		var users = Users.Where(t => t.Token == token);
		if (users.Count() == 0)
			return null;
			
		return users.First().Id;
	}
	
	public int? GetGroupId(string token)
	{
		var groups = Groups.Where(t => t.Token == token);
		if (groups.Count() == 0)
			return null;
			
		return groups.First().Id;
	}

	internal void UpdateUserToken(string token, string userId)
	{
		var ut = Users.Where(e => e.Token == token).FirstOrDefault();
		if (ut == null)
			return;
		ut.LastDate = DateTime.Now;
		Users.Update(ut);
		SaveChanges();
	}
}
