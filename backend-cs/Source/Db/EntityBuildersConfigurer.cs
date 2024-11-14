using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TdnApi.Db.Entities;

namespace TdnApi.Db.Configuers;

public interface IEntityBuildersConfigurer
{
	void ConfigureModel(EntityTypeBuilder<UserData> builder);
	void ConfigureModel(EntityTypeBuilder<UserCharacterData> builder);
	void ConfigureModel(EntityTypeBuilder<UserGroupData> builder);
	void ConfigureModel(EntityTypeBuilder<GroupData> builder);
	void ConfigureModel(EntityTypeBuilder<ItemData> builder);
	void ConfigureModel(EntityTypeBuilder<CharacterData> builder);
	void ConfigureModel(EntityTypeBuilder<NoteData> builder);
	void ConfigureModel(EntityTypeBuilder<InventoryData> builder);
	void ConfigureModel(EntityTypeBuilder<ItemInventoryData> builder);
}

public class EntityBuildersConfigurer : IEntityBuildersConfigurer
{
	public void ConfigureModel(EntityTypeBuilder<CharacterData> builder)
	{
		builder.ToTable("character");
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.Id).HasColumnName("character_id");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.Name).HasColumnName("name");
		builder.Property(e => e.Description).HasColumnName("description");
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
	}

	public void ConfigureModel(EntityTypeBuilder<GroupData> builder)
	{
		builder.ToTable("group");
		builder.Property(e => e.Id).HasColumnName("group_id");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.Name).HasColumnName("name");
	}

	public void ConfigureModel(EntityTypeBuilder<InventoryData> builder)
	{
		builder.ToTable("inventory");
		builder.Property(e => e.Id).HasColumnName("inventory_id");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.OwnerId).HasColumnName("owner_id");
		builder.HasOne(e => e.Owner).WithMany().HasForeignKey(e => e.OwnerId);
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

	public void ConfigureModel(EntityTypeBuilder<UserCharacterData> builder)
	{
		builder.ToTable("user_character");
		builder.Property(e => e.UserId).HasColumnName("user_id");
		builder.Property(e => e.CharacterId).HasColumnName("character_id");
		builder.Property(e => e.Privileges).HasColumnName("privileges");
		builder.HasOne(e => e.Character).WithMany().HasForeignKey(e => e.CharacterId);
		builder.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
		builder.HasKey(e => new {e.UserId, e.CharacterId});
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

	public void ConfigureModel(EntityTypeBuilder<NoteData> builder)
	{
		builder.ToTable("note");
		builder.Property(e => e.Id).HasColumnName("note_id");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.Header).HasColumnName("header");
		builder.Property(e => e.Body).HasColumnName("body");
		builder.Property(e => e.OwnerId).HasColumnName("owner_id");
		builder.HasOne(e => e.Owner).WithMany().HasForeignKey(e => e.OwnerId);
	}

	public void ConfigureModel(EntityTypeBuilder<ItemData> builder)
	{
		builder.ToTable("item");
		builder.Property(e => e.Id).HasColumnName("item_id");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.Name).HasColumnName("name");
		builder.Property(e => e.Description).HasColumnName("description");
		builder.Property(e => e.Image).HasColumnName("image_link");
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
	}

	public void ConfigureModel(EntityTypeBuilder<ItemInventoryData> builder)
	{
		builder.ToTable("inventory_item");
		builder.Property(e => e.ItemId).HasColumnName("item_id");
		builder.Property(e => e.InventoryId).HasColumnName("inventory_id");
		builder.HasKey(e => new {e.ItemId, e.InventoryId});
		builder.Property(e => e.Amount).HasColumnName("amount");
		builder.HasOne(e => e.Item).WithMany().HasForeignKey(e => e.ItemId);
		builder.HasOne(e => e.Inventory).WithMany().HasForeignKey(e => e.InventoryId);
	}
}