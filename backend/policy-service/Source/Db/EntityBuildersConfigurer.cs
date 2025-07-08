using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tdn.Db.Entities;

namespace Tdn.Db.Configuers;

public interface IEntityBuildersConfigurer
{
    void ConfigureModel(EntityTypeBuilder<UserGroupData> builder);
    void ConfigureModel(EntityTypeBuilder<UserCharacterData> builder);
}

public class EntityBuildersConfigurer : IEntityBuildersConfigurer
{
    public void ConfigureModel(EntityTypeBuilder<UserGroupData> builder)
    {
        builder.ToTable("user_group");
        builder.HasKey(e => new {e.UserId, e.GroupId});
        builder.Property(e => e.UserId).HasColumnName("user_id");
        builder.Property(e => e.GroupId).HasColumnName("group_id");
  		  builder.Property(e => e.IsAdmin).HasColumnName("is_admin");
    }

    public void ConfigureModel(EntityTypeBuilder<UserCharacterData> builder)
    {
        builder.ToTable("user_character");
        builder.HasKey(l => new { l.UserId, l.GroupId, l.CharacterId });
        
        builder.Property(l => l.UserId).HasColumnName("user_id");
        builder.Property(e => e.GroupId).HasColumnName("group_id");
        builder.Property(e => e.CharacterId).HasColumnName("character_id");
        builder.Property(e => e.CanWrite).HasColumnName("can_write");
        
        builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => new {e.UserId, e.GroupId});
    }
}