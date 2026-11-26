using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Sheets;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.WorldContent;

namespace Tdn.Campaigns.Persistence;

public sealed class CampaignDbContext(DbContextOptions<CampaignDbContext> options) : DbContext(options)
{
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<CampaignMember> CampaignMembers => Set<CampaignMember>();
    public DbSet<TemplateMetadata> TemplateMetadata => Set<TemplateMetadata>();
    public DbSet<CharacterMetadata> CharacterMetadata => Set<CharacterMetadata>();
    public DbSet<CharacterAssignment> CharacterAssignments => Set<CharacterAssignment>();
    public DbSet<FormulaMetadata> FormulaMetadata => Set<FormulaMetadata>();
    public DbSet<ViewMetadata> ViewMetadata => Set<ViewMetadata>();
    public DbSet<CatalogEntry<ItemCatalog>> ItemDefinitions => Set<CatalogEntry<ItemCatalog>>();
    public DbSet<CatalogEntry<SkillCatalog>> SkillDefinitions => Set<CatalogEntry<SkillCatalog>>();
    public DbSet<CharacterCatalogEntry<ItemCatalog>> CharacterItems => Set<CharacterCatalogEntry<ItemCatalog>>();
    public DbSet<CharacterCatalogEntry<SkillCatalog>> CharacterSkills => Set<CharacterCatalogEntry<SkillCatalog>>();
    public DbSet<CatalogAdditionReceipt<ItemCatalog>> ItemAdditionReceipts => Set<CatalogAdditionReceipt<ItemCatalog>>();
    public DbSet<CatalogAdditionReceipt<SkillCatalog>> SkillAdditionReceipts => Set<CatalogAdditionReceipt<SkillCatalog>>();
    public DbSet<WorldMaterial> WorldMaterials => Set<WorldMaterial>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var campaign = modelBuilder.Entity<Campaign>();
        campaign.ToTable("Campaigns", table => table.HasCheckConstraint("CK_Campaigns_MetadataRevision", "MetadataRevision >= 1"));
        campaign.HasKey(x => x.Id);
        campaign.Property(x => x.Id).ValueGeneratedOnAdd();
        campaign.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        campaign.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        campaign.Property(x => x.CreationRequestId).IsRequired();
        campaign.HasIndex(x => x.CreationRequestId).IsUnique();

        var member = modelBuilder.Entity<CampaignMember>();
        member.ToTable("CampaignMembers", table => table.HasCheckConstraint("CK_CampaignMembers_MetadataRevision", "MetadataRevision >= 1"));
        member.HasKey(x => new { x.CampaignId, x.UserId });
        member.Property(x => x.IsAdmin).IsRequired();
        member.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        member.HasIndex(x => x.UserId);
        member.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);

        var template = modelBuilder.Entity<TemplateMetadata>();
        template.ToTable("CampaignTemplates", table => table.HasCheckConstraint("CK_CampaignTemplates_MetadataRevision", "MetadataRevision >= 1"));
        template.HasKey(x => x.CampaignId);
        template.Property(x => x.CampaignId).ValueGeneratedNever();
        template.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        template.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        template.HasOne(x => x.Campaign).WithOne(x => x.Template).HasForeignKey<TemplateMetadata>(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);

        var character = modelBuilder.Entity<CharacterMetadata>();
        character.ToTable("CharacterMetadata", table => table.HasCheckConstraint("CK_CharacterMetadata_MetadataRevision", "MetadataRevision >= 1"));
        character.HasKey(x => x.Id);
        character.HasAlternateKey(x => new { x.CampaignId, x.Id });
        character.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        character.Property(x => x.Importance).IsRequired();
        character.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        character.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);

        var assignment = modelBuilder.Entity<CharacterAssignment>();
        assignment.ToTable("CharacterAssignments", table => table.HasCheckConstraint("CK_CharacterAssignments_MetadataRevision", "MetadataRevision >= 1"));
        assignment.HasKey(x => new { x.CampaignId, x.CharacterId, x.UserId });
        assignment.Property(x => x.CanWrite).IsRequired();
        assignment.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        assignment.HasOne(x => x.Character).WithMany().HasForeignKey(x => new { x.CampaignId, x.CharacterId }).HasPrincipalKey(x => new { x.CampaignId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        assignment.HasOne(x => x.CampaignMember).WithMany().HasForeignKey(x => new { x.CampaignId, x.UserId }).HasPrincipalKey(x => new { x.CampaignId, x.UserId }).OnDelete(DeleteBehavior.Restrict);

        var formula = modelBuilder.Entity<FormulaMetadata>();
        formula.ToTable("FormulaMetadata", table => table.HasCheckConstraint("CK_FormulaMetadata_MetadataRevision", "MetadataRevision >= 1"));
        formula.HasKey(x => x.Id);
        formula.HasAlternateKey(x => new { x.CampaignId, x.Id });
        formula.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        formula.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        formula.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);

        var view = modelBuilder.Entity<ViewMetadata>();
        view.ToTable("ViewMetadata", table => table.HasCheckConstraint("CK_ViewMetadata_MetadataRevision", "MetadataRevision >= 1"));
        view.HasKey(x => x.Id);
        view.HasAlternateKey(x => new { x.CampaignId, x.Id });
        view.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        view.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        view.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);

        ConfigureCatalog<ItemCatalog>(modelBuilder);
        ConfigureCatalog<SkillCatalog>(modelBuilder);
        var material = modelBuilder.Entity<WorldMaterial>();
        material.ToTable("WorldMaterials", table => table.HasCheckConstraint("CK_WorldMaterials_MetadataRevision", "MetadataRevision >= 1"));
        material.HasKey(x => x.Id);
        material.HasAlternateKey(x => new { x.CampaignId, x.Id });
        material.Property(x => x.Id).ValueGeneratedNever();
        material.Property(x => x.Kind).IsRequired().HasColumnType("varchar(32)");
        material.Property(x => x.Title).IsRequired().HasColumnType("longtext");
        material.Property(x => x.Description).IsRequired().HasColumnType("longtext");
        material.Property(x => x.Tags).IsRequired().HasColumnType("longtext");
        material.Property(x => x.IsPublished).IsRequired().HasDefaultValue(false);
        material.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        material.HasIndex(x => new { x.CampaignId, x.Kind });
        material.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureCatalog<TCatalog>(ModelBuilder modelBuilder) where TCatalog : ICatalogType
    {
        var catalog = modelBuilder.Entity<CatalogEntry<TCatalog>>();
        catalog.ToTable(TCatalog.DefinitionsTable, table => table.HasCheckConstraint($"CK_{TCatalog.DefinitionsTable}_MetadataRevision", "MetadataRevision >= 1"));
        catalog.HasKey(x => x.Id);
        catalog.HasAlternateKey(x => new { x.CampaignId, x.Id });
        catalog.Property(x => x.Id).ValueGeneratedNever();
        catalog.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        catalog.Property(x => x.CreatorUserId).IsRequired(false);
        catalog.Property(x => x.IsHidden).IsRequired();
        catalog.Property(x => x.QuantityUnit).IsRequired(false);
        catalog.Property(x => x.AllowNegative).IsRequired();
        catalog.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        catalog.HasIndex(x => x.CampaignId);
        catalog.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict);

        var characterEntry = modelBuilder.Entity<CharacterCatalogEntry<TCatalog>>();
        characterEntry.ToTable(TCatalog.CharacterEntriesTable, table => table.HasCheckConstraint($"CK_{TCatalog.CharacterEntriesTable}_MetadataRevision", "MetadataRevision >= 1"));
        characterEntry.HasKey(x => x.Id);
        characterEntry.Property(x => x.Id).ValueGeneratedNever();
        characterEntry.Property(x => x.CampaignId).IsRequired();
        characterEntry.Property(x => x.CharacterId).IsRequired();
        characterEntry.Property(x => x.CatalogEntryId).IsRequired();
        characterEntry.Property(x => x.Quantity).HasColumnType("decimal(65,28)").IsRequired(false);
        characterEntry.Property(x => x.MetadataRevision).IsRequired().IsConcurrencyToken();
        characterEntry.HasIndex(x => new { x.CampaignId, x.CharacterId, x.CatalogEntryId });
        characterEntry.HasIndex(x => new { x.CampaignId, x.CatalogEntryId });
        characterEntry.HasOne(x => x.Character).WithMany().HasForeignKey(x => new { x.CampaignId, x.CharacterId }).HasPrincipalKey(x => new { x.CampaignId, x.Id }).OnDelete(DeleteBehavior.Restrict);
        characterEntry.HasOne(x => x.CatalogEntry).WithMany().HasForeignKey(x => new { x.CampaignId, x.CatalogEntryId }).HasPrincipalKey(x => new { x.CampaignId, x.Id }).OnDelete(DeleteBehavior.Restrict);

        var receipt = modelBuilder.Entity<CatalogAdditionReceipt<TCatalog>>();
        receipt.ToTable(TCatalog.AdditionReceiptsTable);
        receipt.HasKey(x => new { x.CampaignId, x.CharacterId, x.RequestId });
        receipt.Property(x => x.CampaignId).IsRequired();
        receipt.Property(x => x.CharacterId).IsRequired();
        receipt.Property(x => x.RequestId).IsRequired();
        receipt.Property(x => x.EntryId).IsRequired();
        receipt.Property(x => x.CatalogEntryId).IsRequired();
        receipt.HasOne<Tdn.Campaigns.Sheets.CharacterMetadata>().WithMany().HasForeignKey(x => new { x.CampaignId, x.CharacterId }).HasPrincipalKey(x => new { x.CampaignId, x.Id }).OnDelete(DeleteBehavior.Restrict);
    }
}
