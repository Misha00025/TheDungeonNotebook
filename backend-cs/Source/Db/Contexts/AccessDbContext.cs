using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Contexts;

public class AccessDbContext : DbContext
{
	private IEntityBuildersConfigurer _configurer;
	
	public AccessDbContext(DbContextOptions options, [FromServices]IEntityBuildersConfigurer configurer) : base(options)
	{
		_configurer = configurer;
	}
	
	protected override void OnModelCreating(ModelBuilder builder)
	{
		_configurer.ConfigureModel(builder.Entity<UserData>());
		_configurer.ConfigureModel(builder.Entity<GroupData>());
		_configurer.ConfigureModel(builder.Entity<CharacterData>());
		_configurer.ConfigureModel(builder.Entity<UserGroupData>());		
		_configurer.ConfigureModel(builder.Entity<UserCharacterData>());
				
		base.OnModelCreating(builder);
	}
	
	public DbSet<CharacterData> Characters => Set<CharacterData>();
	public DbSet<UserGroupData> UserGroups => Set<UserGroupData>();
	public DbSet<UserCharacterData> UserCharacters => Set<UserCharacterData>();
}