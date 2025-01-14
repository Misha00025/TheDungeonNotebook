using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Configuers;

public interface IEntityBuildersConfigurer
{
	void ConfigureModel(EntityTypeBuilder<UserData> builder);
	void ConfigureModel(EntityTypeBuilder<UserGroupData> builder);
	void ConfigureModel(EntityTypeBuilder<GroupData> builder);
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
}