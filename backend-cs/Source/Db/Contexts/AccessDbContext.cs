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
		_configurer.ConfigureUserModel(builder.Entity<UserData>());
		_configurer.ConfigureGroupModel(builder.Entity<GroupData>());
		_configurer.ConfigureCharacterModel(builder.Entity<CharacterData>());
		
		var ug = builder.Entity<UserGroupData>();
		ug.ToTable("user_group");
		ug.Property(e => e.GroupId).HasColumnName("group_id");
		ug.Property(e => e.UserId).HasColumnName("user_id");
		ug.Property(e => e.Privileges).HasColumnName("privileges");
		ug.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
		ug.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
		
		var uc = builder.Entity<UserCharacterData>();
		uc.ToTable("user_character");
		uc.Property(e => e.UserId).HasColumnName("user_id");
		uc.Property(e => e.CharacterId).HasColumnName("character_id");
		uc.Property(e => e.Privileges).HasColumnName("privileges");
		uc.HasOne(e => e.Character).WithMany().HasForeignKey(e => e.CharacterId);
		uc.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
				
		base.OnModelCreating(builder);
	}
	
	public DbSet<CharacterData> Characters => Set<CharacterData>();
	public DbSet<UserGroupData> UserGroups => Set<UserGroupData>();
	public DbSet<UserCharacterData> UserCharacters => Set<UserCharacterData>();
}