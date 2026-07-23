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
	void ConfigureModel(EntityTypeBuilder<SkillData> builder);
	void ConfigureModel(EntityTypeBuilder<CharacterSkillData> builder);
	void ConfigureModel(EntityTypeBuilder<CharacterItemData> builder);
	void ConfigureModel(EntityTypeBuilder<UserGroupData> builder);
	void ConfigureModel(EntityTypeBuilder<UserCharacterData> builder);
	void ConfigureModel(EntityTypeBuilder<NoteData> builder);
	void ConfigureModel(EntityTypeBuilder<NoteKeywordData> builder);
	void ConfigureModel(EntityTypeBuilder<QuestData> builder);
	void ConfigureModel(EntityTypeBuilder<QuestAssignmentData> builder);
}

public class EntityBuildersConfigurer : IEntityBuildersConfigurer
{

	public void ConfigureModel(EntityTypeBuilder<GroupData> builder)
	{
		builder.ToTable("group");
		builder.Property(e => e.Id).HasColumnName("group_id");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.Name).HasColumnName("name");
		builder.Property(e => e.Icon).HasColumnName("photo_link");
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
	
	public void ConfigureModel(EntityTypeBuilder<SkillData> builder)
	{
		builder.ToTable("skill");
		builder.HasKey(e => e.Id);
		builder.Property(e => e.Id).HasColumnName("skill_id");
		builder.Property(e => e.GroupId).HasColumnName("group_id");
		builder.Property(e => e.UUID).HasColumnName("uuid");
		builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);		
	}
	
	public void ConfigureModel(EntityTypeBuilder<CharacterSkillData> builder)
	{
		builder.ToTable("character_skill");
		builder.HasKey(e => new { e.SkillId, e.CharacterId });
		builder.Property(e => e.SkillId).HasColumnName("skill_id");
		builder.Property(e => e.CharacterId).HasColumnName("character_id");
		builder.HasOne(e => e.Character).WithMany().HasForeignKey(e => e.CharacterId);		
		builder.HasOne(e => e.Skill).WithMany().HasForeignKey(e => e.SkillId);		
	}

    public void ConfigureModel(EntityTypeBuilder<CharacterItemData> builder)
    {
        builder.ToTable("character_item");
		builder.HasKey(e => new { e.ItemId, e.CharacterId });
		builder.Property(e => e.ItemId).HasColumnName("item_id");
		builder.Property(e => e.CharacterId).HasColumnName("character_id");
		builder.Property(e => e.Amount).HasColumnName("amount");
		builder.HasOne(e => e.Character).WithMany().HasForeignKey(e => e.CharacterId);		
		builder.HasOne(e => e.Item).WithMany().HasForeignKey(e => e.ItemId);
    }

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

    public void ConfigureModel(EntityTypeBuilder<NoteData> builder)
    {
        builder.ToTable("note");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("note_id");
        builder.Property(e => e.GroupId).HasColumnName("group_id");
        builder.Property(e => e.UUID).HasColumnName("uuid");
        builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
        builder.Property(e => e.CharacterId).HasColumnName("character_id");
        builder.HasOne(e => e.Character).WithMany().HasForeignKey(e => e.CharacterId).IsRequired(false).OnDelete(DeleteBehavior.Cascade);
        builder.Property(e => e.Header).HasColumnName("header");
        builder.Property(e => e.ShortDescription).HasColumnName("short_description");
        builder.Property(e => e.AdditionDate).HasColumnName("addition_date");
        builder.Property(e => e.ModifyDate).HasColumnName("modified_date");
        builder.HasMany(e => e.Keywords).WithOne(e => e.Note).HasForeignKey(e => e.NoteId);
    }

    public void ConfigureModel(EntityTypeBuilder<NoteKeywordData> builder)
    {
        builder.ToTable("note_keyword");
        builder.HasKey(e => new { e.NoteId, e.Keyword });
        builder.Property(e => e.NoteId).HasColumnName("note_id");
        builder.Property(e => e.Keyword).HasColumnName("keyword").HasMaxLength(100);
    }

    public void ConfigureModel(EntityTypeBuilder<QuestData> builder)
    {
        builder.ToTable("quest");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("quest_id");
        builder.Property(e => e.GroupId).HasColumnName("group_id");
        builder.Property(e => e.UUID).HasColumnName("uuid");
        builder.HasOne(e => e.Group).WithMany().HasForeignKey(e => e.GroupId);
        builder.Property(e => e.Header).HasColumnName("header");
        builder.Property(e => e.Status).HasColumnName("status");
    }

    public void ConfigureModel(EntityTypeBuilder<QuestAssignmentData> builder)
    {
        builder.ToTable("quest_assignment");
        builder.HasKey(e => new { e.QuestId, e.CharacterId });
        builder.Property(e => e.QuestId).HasColumnName("quest_id");
        builder.Property(e => e.CharacterId).HasColumnName("character_id");
        builder.HasOne(e => e.Quest).WithMany().HasForeignKey(e => e.QuestId);
        builder.HasOne(e => e.Character).WithMany().HasForeignKey(e => e.CharacterId);
    }
}