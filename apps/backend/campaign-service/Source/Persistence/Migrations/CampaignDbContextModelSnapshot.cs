using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Pomelo.EntityFrameworkCore.MySql.Metadata;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Catalog;
using Tdn.Campaigns.Persistence;
using Tdn.Campaigns.Sheets;
using Tdn.Campaigns.WorldContent;

namespace Tdn.Campaigns.Persistence.Migrations;

[DbContext(typeof(CampaignDbContext))]
public sealed class CampaignDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        BuildFrozenModel(modelBuilder);
    }

    public static void BuildFrozenModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "9.0.11")
            .HasAnnotation("Relational:MaxIdentifierLength", 64);

        modelBuilder.Entity<Campaign>(entity =>
        {
            entity.Property(x => x.Id).ValueGeneratedOnAdd()
                .HasColumnType("int")
                .HasAnnotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn);
            entity.Property(x => x.Name).IsRequired().HasColumnType("longtext");
            entity.Property(x => x.MetadataRevision).IsConcurrencyToken().HasColumnType("bigint");
            entity.Property(x => x.CreationRequestId).HasColumnType("char(36)");
            entity.Property(x => x.CreatedByType).HasColumnType("int");
            entity.Property(x => x.CreatedById).HasColumnType("int");
            entity.HasKey(x => x.Id);
            entity.HasIndex(x => x.CreationRequestId).IsUnique();
            entity.ToTable("Campaigns", table => table.HasCheckConstraint("CK_Campaigns_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity<CampaignMember>(entity =>
        {
            entity.Property(x => x.CampaignId).HasColumnType("int");
            entity.Property(x => x.UserId).HasColumnType("int");
            entity.Property(x => x.IsAdmin).HasColumnType("tinyint(1)");
            entity.Property(x => x.MetadataRevision).IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey(x => new { x.CampaignId, x.UserId });
            entity.HasIndex(x => x.UserId);
            entity.ToTable("CampaignMembers", table => table.HasCheckConstraint("CK_CampaignMembers_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity<CampaignMember>()
            .HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId)
            .OnDelete(DeleteBehavior.Restrict).IsRequired();

        modelBuilder.Entity<TemplateMetadata>(entity =>
        {
            entity.Property(x => x.CampaignId).ValueGeneratedNever().HasColumnType("int");
            entity.Property(x => x.Name).IsRequired().HasColumnType("longtext");
            entity.Property(x => x.MetadataRevision).IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey(x => x.CampaignId);
            entity.ToTable("CampaignTemplates", table => table.HasCheckConstraint("CK_CampaignTemplates_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity<TemplateMetadata>()
            .HasOne(x => x.Campaign).WithOne(x => x.Template).HasForeignKey<TemplateMetadata>(x => x.CampaignId)
            .OnDelete(DeleteBehavior.Restrict).IsRequired();

        modelBuilder.Entity<CharacterMetadata>(entity =>
        {
            entity.Property(x => x.Id).ValueGeneratedOnAdd().HasColumnType("char(36)");
            entity.Property(x => x.CampaignId).HasColumnType("int");
            entity.Property(x => x.Name).IsRequired().HasColumnType("longtext");
            entity.Property(x => x.Importance).HasColumnType("int");
            entity.Property(x => x.MetadataRevision).IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey(x => x.Id);
            entity.HasAlternateKey(x => new { x.CampaignId, x.Id });
            entity.ToTable("CharacterMetadata", table => table.HasCheckConstraint("CK_CharacterMetadata_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity<CharacterMetadata>()
            .HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId)
            .OnDelete(DeleteBehavior.Restrict).IsRequired();

        modelBuilder.Entity<CharacterAssignment>(entity =>
        {
            entity.Property(x => x.CampaignId).HasColumnType("int");
            entity.Property(x => x.CharacterId).HasColumnType("char(36)");
            entity.Property(x => x.UserId).HasColumnType("int");
            entity.Property(x => x.CanWrite).HasColumnType("tinyint(1)");
            entity.Property(x => x.MetadataRevision).IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey(x => new { x.CampaignId, x.CharacterId, x.UserId });
            entity.HasIndex(x => new { x.CampaignId, x.UserId });
            entity.ToTable("CharacterAssignments", table => table.HasCheckConstraint("CK_CharacterAssignments_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity<CharacterAssignment>()
            .HasOne(x => x.Character).WithMany().HasForeignKey(x => new { x.CampaignId, x.CharacterId })
            .HasPrincipalKey(x => new { x.CampaignId, x.Id }).OnDelete(DeleteBehavior.Restrict).IsRequired();
        modelBuilder.Entity<CharacterAssignment>()
            .HasOne(x => x.CampaignMember).WithMany().HasForeignKey(x => new { x.CampaignId, x.UserId })
            .HasPrincipalKey(x => new { x.CampaignId, x.UserId }).OnDelete(DeleteBehavior.Restrict).IsRequired();

        modelBuilder.Entity<FormulaMetadata>(entity =>
        {
            entity.Property(x => x.Id).ValueGeneratedOnAdd().HasColumnType("char(36)");
            entity.Property(x => x.CampaignId).HasColumnType("int");
            entity.Property(x => x.Name).IsRequired().HasColumnType("longtext");
            entity.Property(x => x.MetadataRevision).IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey(x => x.Id);
            entity.HasAlternateKey(x => new { x.CampaignId, x.Id });
            entity.ToTable("FormulaMetadata", table => table.HasCheckConstraint("CK_FormulaMetadata_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity<FormulaMetadata>()
            .HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId)
            .OnDelete(DeleteBehavior.Restrict).IsRequired();

        modelBuilder.Entity<ViewMetadata>(entity =>
        {
            entity.Property(x => x.Id).ValueGeneratedOnAdd().HasColumnType("char(36)");
            entity.Property(x => x.CampaignId).HasColumnType("int");
            entity.Property(x => x.Name).IsRequired().HasColumnType("longtext");
            entity.Property(x => x.MetadataRevision).IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey(x => x.Id);
            entity.HasAlternateKey(x => new { x.CampaignId, x.Id });
            entity.ToTable("ViewMetadata", table => table.HasCheckConstraint("CK_ViewMetadata_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity<ViewMetadata>()
            .HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId)
            .OnDelete(DeleteBehavior.Restrict).IsRequired();

        ConfigureCatalog<ItemCatalog>(modelBuilder, "ItemDefinitions", "CharacterItems", "ItemAdditionReceipts");
        ConfigureCatalog<SkillCatalog>(modelBuilder, "SkillDefinitions", "CharacterSkills", "SkillAdditionReceipts");
        var material = modelBuilder.Entity<WorldMaterial>();
        material.ToTable("WorldMaterials", table => table.HasCheckConstraint("CK_WorldMaterials_MetadataRevision", "MetadataRevision >= 1"));
        material.HasKey(x => x.Id);
        material.HasAlternateKey(x => new { x.CampaignId, x.Id });
        material.Property(x => x.Id).ValueGeneratedNever().HasColumnType("char(36)");
        material.Property(x => x.CampaignId).HasColumnType("int");
        material.Property(x => x.Kind).IsRequired().HasColumnType("varchar(32)");
        material.Property(x => x.Title).IsRequired().HasColumnType("longtext");
        material.Property(x => x.Description).IsRequired().HasColumnType("longtext");
        material.Property(x => x.Tags).IsRequired().HasColumnType("longtext");
        material.Property(x => x.IsPublished).IsRequired().ValueGeneratedOnAdd().HasColumnType("tinyint(1)").HasDefaultValue(false);
        material.Property(x => x.MetadataRevision).IsConcurrencyToken().HasColumnType("bigint");
        material.HasIndex(x => new { x.CampaignId, x.Kind });
        modelBuilder.Entity<WorldMaterial>().HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict).IsRequired();

    }

    private static void ConfigureCatalog<TCatalog>(ModelBuilder modelBuilder, string definitionTable, string characterTable, string receiptTable) where TCatalog : ICatalogType
    {
        var definition = modelBuilder.Entity<CatalogEntry<TCatalog>>();
        definition.ToTable(definitionTable, table => table.HasCheckConstraint($"CK_{definitionTable}_MetadataRevision", "MetadataRevision >= 1"));
        definition.HasKey(x => x.Id);
        definition.HasAlternateKey(x => new { x.CampaignId, x.Id });
        definition.Property(x => x.Id).ValueGeneratedNever().HasColumnType("char(36)");
        definition.Property(x => x.CampaignId).HasColumnType("int");
        definition.Property(x => x.Name).IsRequired().HasColumnType("longtext");
        definition.Property(x => x.CreatorUserId).IsRequired(false).HasColumnType("int");
        definition.Property(x => x.IsHidden).IsRequired().HasColumnType("tinyint(1)");
        definition.Property(x => x.QuantityUnit).IsRequired(false).HasColumnType("int");
        definition.Property(x => x.AllowNegative).IsRequired().HasColumnType("tinyint(1)");
        definition.Property(x => x.MetadataRevision).IsConcurrencyToken().HasColumnType("bigint");
        definition.HasIndex(x => x.CampaignId);
        definition.HasOne(x => x.Campaign).WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Restrict).IsRequired();

        var characterEntry = modelBuilder.Entity<CharacterCatalogEntry<TCatalog>>();
        characterEntry.ToTable(characterTable, table => table.HasCheckConstraint($"CK_{characterTable}_MetadataRevision", "MetadataRevision >= 1"));
        characterEntry.HasKey(x => x.Id);
        characterEntry.Property(x => x.Id).ValueGeneratedNever().HasColumnType("char(36)");
        characterEntry.Property(x => x.CampaignId).HasColumnType("int");
        characterEntry.Property(x => x.CharacterId).HasColumnType("char(36)");
        characterEntry.Property(x => x.CatalogEntryId).HasColumnType("char(36)");
        characterEntry.Property(x => x.Quantity).HasColumnType("decimal(65,28)");
        characterEntry.Property(x => x.MetadataRevision).IsConcurrencyToken().HasColumnType("bigint");
        characterEntry.HasIndex(x => new { x.CampaignId, x.CharacterId, x.CatalogEntryId });
        characterEntry.HasIndex(x => new { x.CampaignId, x.CatalogEntryId });
        characterEntry.HasOne(x => x.Character).WithMany().HasForeignKey(x => new { x.CampaignId, x.CharacterId }).HasPrincipalKey(x => new { x.CampaignId, x.Id }).OnDelete(DeleteBehavior.Restrict).IsRequired();
        characterEntry.HasOne(x => x.CatalogEntry).WithMany().HasForeignKey(x => new { x.CampaignId, x.CatalogEntryId }).HasPrincipalKey(x => new { x.CampaignId, x.Id }).OnDelete(DeleteBehavior.Restrict).IsRequired();

        var receipt = modelBuilder.Entity<CatalogAdditionReceipt<TCatalog>>();
        receipt.ToTable(receiptTable);
        receipt.HasKey(x => new { x.CampaignId, x.CharacterId, x.RequestId });
        receipt.Property(x => x.CampaignId).HasColumnType("int");
        receipt.Property(x => x.CharacterId).HasColumnType("char(36)");
        receipt.Property(x => x.RequestId).HasColumnType("char(36)");
        receipt.Property(x => x.EntryId).HasColumnType("char(36)");
        receipt.Property(x => x.CatalogEntryId).HasColumnType("char(36)");
        receipt.HasOne<CharacterMetadata>().WithMany().HasForeignKey(x => new { x.CampaignId, x.CharacterId }).HasPrincipalKey(x => new { x.CampaignId, x.Id }).OnDelete(DeleteBehavior.Restrict).IsRequired();
    }
}
