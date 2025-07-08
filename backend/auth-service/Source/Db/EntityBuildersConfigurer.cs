using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tdn.Db.Entities;

namespace Tdn.Db.Configuers;

public interface IEntityBuildersConfigurer
{
	void ConfigureModel(EntityTypeBuilder<UserData> builder);
}

public class EntityBuildersConfigurer : IEntityBuildersConfigurer
{


    // public void ConfigureModel(EntityTypeBuilder<CharacterData> builder)
    // {
    // 	builder.ToTable("character");
    // 	builder.HasKey(e => e.Id);
    // 	builder.Property(e => e.Id).HasColumnName("character_id");
    // 	builder.Property(e => e.GroupId).HasColumnName("group_id");
    // 	builder.Property(e => e.UUID).HasColumnName("uuid");
    // 	builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);

    // 	builder.Property(e => e.OwnerId).HasColumnName("owner_id");
    // 	builder.Property(e => e.TemplateId).HasColumnName("template_id");
    // 	builder.HasOne(e => e.Template).WithMany().HasForeignKey(e => e.TemplateId);
    // }
    public void ConfigureModel(EntityTypeBuilder<UserData> builder)
    {
      builder.ToTable("auth_data");
      builder.HasKey(e => e.Id);
      builder.Property(e => e.Id).HasColumnName("user_id");
      builder.Property(e => e.Username).HasColumnName("username");
      builder.Property(e => e.PasswordHash).HasColumnName("password_hash");
    }
}