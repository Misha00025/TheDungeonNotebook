using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tdn.Db.Entities;

namespace Tdn.Db.Configuers;

public interface IEntityBuildersConfigurer
{
	void ConfigureModel(EntityTypeBuilder<GroupData> builder);
	void ConfigureModel(EntityTypeBuilder<ItemData> builder);
	void ConfigureModel(EntityTypeBuilder<CharlistData> builder);
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

	public void ConfigureModel(EntityTypeBuilder<ItemData> builder)
	{
		builder.ToTable("item");
		builder.Property(e => e.Id).HasColumnName("item_id");
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.UUID).HasColumnName("uuid");
		builder.HasKey(e => e.Id);
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
	}

	public void ConfigureModel(EntityTypeBuilder<CharlistData> builder)
	{
		builder.ToTable("charlist_template");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.Id).HasColumnName("template_id");
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.UUID).HasColumnName("uuid");
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
	}

	public void ConfigureModel(EntityTypeBuilder<CharacterData> builder)
	{
		builder.ToTable("character");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.Id).HasColumnName("character_id");
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.UUID).HasColumnName("uuid");
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
		
		builder.Property(e => e.OwnerId).HasColumnName("owner_id");
		builder.Property(e => e.TemplateId).HasColumnName("template_id");
		builder.HasOne(e => e.Template).WithMany().HasForeignKey(e => e.TemplateId);
	}
}