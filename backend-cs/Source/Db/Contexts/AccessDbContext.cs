using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TdnApi.Db.Configuers;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Contexts;

public class AccessDbContext : BaseDbContext
{
    public AccessDbContext(DbContextOptions<CharacterContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
	{
		Configurer.ConfigureModel(builder.Entity<UserData>());
		Configurer.ConfigureModel(builder.Entity<GroupData>());
		Configurer.ConfigureModel(builder.Entity<CharacterData>());
		Configurer.ConfigureModel(builder.Entity<UserGroupData>());		
		Configurer.ConfigureModel(builder.Entity<UserCharacterData>());
				
		base.OnModelCreating(builder);
	}
	
	public DbSet<CharacterData> Characters => Set<CharacterData>();
	public DbSet<UserGroupData> UserGroups => Set<UserGroupData>();
	public DbSet<UserCharacterData> UserCharacters => Set<UserCharacterData>();
}