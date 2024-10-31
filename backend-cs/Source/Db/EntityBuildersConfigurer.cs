using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Configuers;

public interface IEntityBuildersConfigurer
{
	void ConfigureUserModel(EntityTypeBuilder<UserData> builder);
	void ConfigureGroupModel(EntityTypeBuilder<GroupData> builder);
	void ConfigureCharacterModel(EntityTypeBuilder<CharacterData> builder);
}

public class EntityBuildersConfigurer : IEntityBuildersConfigurer
{
	public void ConfigureCharacterModel(EntityTypeBuilder<CharacterData> builder)
	{
		builder.ToTable("character");
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.Id).HasColumnName("character_id");
		builder.Property(e => e.Name).HasColumnName("name");
		builder.Property(e => e.Description).HasColumnName("description");
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
	}

	public void ConfigureGroupModel(EntityTypeBuilder<GroupData> builder)
	{
		builder.ToTable("group");
		builder.Property(e => e.Id).HasColumnName("group_id");
		builder.Property(e => e.Name).HasColumnName("name");
	}

	public void ConfigureUserModel(EntityTypeBuilder<UserData> builder)
	{
		builder.ToTable("user");
		builder.Property(e => e.Id).HasColumnName("user_id");
		builder.Property(e => e.FirstName).HasColumnName("first_name");
		builder.Property(e => e.LastName).HasColumnName("last_name");
		builder.Property(e => e.PhotoLink).HasColumnName("photo_link");
	}
}