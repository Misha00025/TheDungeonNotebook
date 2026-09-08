using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tdn.Db.Entities;

namespace Tdn.Db.Configurers;

public interface IEntityBuildersConfigurer
{
    void ConfigureModel(EntityTypeBuilder<SystemData> builder);
    void ConfigureModel(EntityTypeBuilder<SystemVersionData> builder);
    void ConfigureModel(EntityTypeBuilder<SystemAdminData> builder);
}

public class EntityBuildersConfigurer : IEntityBuildersConfigurer
{
    public void ConfigureModel(EntityTypeBuilder<SystemData> builder)
    {
        builder.ToTable("systems");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id").HasMaxLength(36);
        builder.Property(e => e.Name).HasColumnName("name").IsRequired();
        builder.Property(e => e.Description).HasColumnName("description").IsRequired(false);
        builder.Property(e => e.Icon).HasColumnName("icon").IsRequired(false);
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();
    }

    public void ConfigureModel(EntityTypeBuilder<SystemVersionData> builder)
    {
        builder.ToTable("system_versions");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id").HasMaxLength(36);
        builder.Property(e => e.SystemId).HasColumnName("system_id").HasMaxLength(36).IsRequired();
        builder.Property(e => e.Version).HasColumnName("version").IsRequired();
        builder.Property(e => e.SnapshotId).HasColumnName("snapshot_id").HasMaxLength(36).IsRequired();
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();

        builder.HasOne<SystemData>()
            .WithMany()
            .HasForeignKey(e => e.SystemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.SystemId, e.Version }).IsUnique();
    }

    public void ConfigureModel(EntityTypeBuilder<SystemAdminData> builder)
    {
        builder.ToTable("system_admins");
        builder.HasKey(e => new { e.SystemId, e.SubjectType, e.SubjectId });
        builder.Property(e => e.SystemId).HasColumnName("system_id").HasMaxLength(36).IsRequired();
        builder.Property(e => e.SubjectType).HasColumnName("subject_type").IsRequired();
        builder.Property(e => e.SubjectId).HasColumnName("subject_id").IsRequired();

        builder.HasOne<SystemData>()
            .WithMany()
            .HasForeignKey(e => e.SystemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.SystemId, e.SubjectType, e.SubjectId }).IsUnique();
    }
}
