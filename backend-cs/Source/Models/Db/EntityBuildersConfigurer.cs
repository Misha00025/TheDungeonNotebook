using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tdn.Db.Entities;

namespace Tdn.Db.Configuers;

public interface IEntityBuildersConfigurer
{
	void ConfigureModel(EntityTypeBuilder<UserData> builder);
	void ConfigureModel(EntityTypeBuilder<UserGroupData> builder);
	void ConfigureModel(EntityTypeBuilder<GroupData> builder);
	void ConfigureModel(EntityTypeBuilder<ItemData> builder);
	void ConfigureModel(EntityTypeBuilder<CharlistTemplateData> builder);
	void ConfigureModel(EntityTypeBuilder<CharacterData> builder);
}

public class EntityBuildersConfigurer : IEntityBuildersConfigurer
{

	public void ConfigureModel(EntityTypeBuilder<GroupData> builder)
	{
		builder.ToTable("group");
		builder.Property(e => e.Id).HasColumnName("group_id");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.Name).HasColumnName("name");
	}

	public void ConfigureModel(EntityTypeBuilder<UserData> builder)
	{
		builder.ToTable("user");
		builder.Property(e => e.Id).HasColumnName("user_id");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.FirstName).HasColumnName("first_name");
		builder.Property(e => e.LastName).HasColumnName("last_name");
		builder.Property(e => e.PhotoLink).HasColumnName("photo_link");
	}
	public void ConfigureModel(EntityTypeBuilder<UserGroupData> builder)
	{
		builder.ToTable("user_group");
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.UserId).HasColumnName("user_id");
		builder.HasKey(e => new {e.UserId, e.GroupId});
		builder.Property(e => e.Privileges).HasColumnName("privileges");
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
		builder.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
	}

	public void ConfigureModel(EntityTypeBuilder<ItemData> builder)
	{
		builder.ToTable("item");
		builder.Property(e => e.Id).HasColumnName("item_id");
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.UUID).HasColumnName("uuid");
		builder.HasKey(e => e.Id);
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
	}

	public void ConfigureModel(EntityTypeBuilder<CharlistTemplateData> builder)
	{
		builder.ToTable("charlist_template");
		builder.Property(e => e.Id).HasColumnName("template_id");
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.UUID).HasColumnName("uuid");
		builder.HasKey(e => e.Id);
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
	}

	public void ConfigureModel(EntityTypeBuilder<CharacterData> builder)
	{
		builder.ToTable("character");
		builder.Property(e => e.Id).HasColumnName("character_id");
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.UUID).HasColumnName("uuid");
		builder.HasKey(e => e.Id);
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
		
		builder.Property(e => e.OwnerId).HasColumnName("owner_id");
		builder.Property(e => e.TemplateId).HasColumnName("template_id");
		builder.HasOne(e => e.Template).WithMany().HasForeignKey(e => e.TemplateId);
	}
}