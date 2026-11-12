using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tdn.Db.Entities;

namespace Tdn.Db.Configuers;

public interface IEntityBuildersConfigurer
{
	void ConfigureModel(EntityTypeBuilder<UserData> builder);
	void ConfigureModel(EntityTypeBuilder<LinkedServicesData> builder);
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
        builder.ToTable("user");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("user_id").ValueGeneratedNever();
        builder.Property(e => e.Nickname).HasColumnName("nickname").HasMaxLength(255);
        builder.Property(e => e.VisibleName).HasColumnName("visible_name").HasMaxLength(255);
        builder.Property(e => e.Image).HasColumnName("image_link").HasColumnType("text");
        builder.HasIndex(e => e.Nickname).IsUnique();
    }

    public void ConfigureModel(EntityTypeBuilder<LinkedServicesData> builder)
    {
        builder.ToTable("linked_services");
        builder.HasKey(l => new { l.UserId, l.Platform });
        
        builder.Property(l => l.UserId).HasColumnName("user_id");
        builder.Property(l => l.Platform).HasColumnName("platform").IsRequired().HasMaxLength(50);
        builder.Property(l => l.PlatformId).HasColumnName("platform_id").IsRequired().HasMaxLength(255);
        
        builder.HasOne(l => l.User)
               .WithMany()
               .HasForeignKey(l => l.UserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}