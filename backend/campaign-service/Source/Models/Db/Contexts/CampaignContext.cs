using Microsoft.EntityFrameworkCore;
using Tdn.Db.Configuers;
using Tdn.Db.Entities;

namespace Tdn.Db.Contexts;

public class CampaignContext : BaseDbContext<CampaignContext>
{
    public CampaignContext(DbContextOptions<CampaignContext> options, IEntityBuildersConfigurer configurer) : base(options, configurer)
    {
    }
    
    // Все DbSet'ы из всех контекстов
    public DbSet<GroupData> Groups => Set<GroupData>();
    public DbSet<NoteData> Notes => Set<NoteData>();
    public DbSet<NoteKeywordData> NoteKeywords => Set<NoteKeywordData>();
    public DbSet<QuestData> Quests => Set<QuestData>();
    public DbSet<QuestAssignmentData> QuestAssignments => Set<QuestAssignmentData>();
    public DbSet<ItemData> Items => Set<ItemData>();
    public DbSet<CharacterItemData> CharacterItems => Set<CharacterItemData>();
    public DbSet<SkillData> Skills => Set<SkillData>();
    public DbSet<CharacterSkillData> CharacterSkills => Set<CharacterSkillData>();
    public DbSet<CharacterData> Characters => Set<CharacterData>();
    public DbSet<CharlistData> CharlistTemplates => Set<CharlistData>();
    public DbSet<UserGroupData> UserGroups => Set<UserGroupData>();
    public DbSet<UserCharacterData> UserCharacters => Set<UserCharacterData>();
    
    protected override void OnModelCreating(ModelBuilder builder)
    {
        // Все entity из EntityContext + PolicesContext + GroupContext
        Configurer.ConfigureModel(builder.Entity<GroupData>());
        Configurer.ConfigureModel(builder.Entity<ItemData>());
        Configurer.ConfigureModel(builder.Entity<CharlistData>());
        Configurer.ConfigureModel(builder.Entity<CharacterData>());
        Configurer.ConfigureModel(builder.Entity<SkillData>());
        Configurer.ConfigureModel(builder.Entity<CharacterSkillData>());
        Configurer.ConfigureModel(builder.Entity<CharacterItemData>());
        Configurer.ConfigureModel(builder.Entity<NoteData>());
        Configurer.ConfigureModel(builder.Entity<NoteKeywordData>());
        Configurer.ConfigureModel(builder.Entity<QuestData>());
        Configurer.ConfigureModel(builder.Entity<QuestAssignmentData>());
        Configurer.ConfigureModel(builder.Entity<UserGroupData>());
        Configurer.ConfigureModel(builder.Entity<UserCharacterData>());
        base.OnModelCreating(builder);
    }
}
