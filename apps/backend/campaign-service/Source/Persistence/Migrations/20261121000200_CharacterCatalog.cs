using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Pomelo.EntityFrameworkCore.MySql.Metadata;
using Tdn.Campaigns.Persistence;

namespace Tdn.Campaigns.Persistence.Migrations;

[DbContext(typeof(CampaignDbContext))]
[Migration("20261121000200_CharacterCatalog")]
public sealed class CharacterCatalog : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "CharacterCatalogEntries",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false),
                CampaignId = table.Column<int>(type: "int", nullable: false),
                CharacterId = table.Column<Guid>(type: "char(36)", nullable: false),
                CatalogEntryId = table.Column<Guid>(type: "char(36)", nullable: false),
                Quantity = table.Column<decimal>(type: "decimal(65,28)", nullable: true),
                MetadataRevision = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CharacterCatalogEntries", x => x.Id);
                table.ForeignKey("FK_CharacterCatalogEntries_CharacterMetadata_CampaignId_CharacterId", x => new { x.CampaignId, x.CharacterId }, "CharacterMetadata", new[] { "CampaignId", "Id" }, onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_CharacterCatalogEntries_CatalogEntries_CampaignId_CatalogEntryId", x => new { x.CampaignId, x.CatalogEntryId }, "CatalogEntries", new[] { "CampaignId", "Id" }, onDelete: ReferentialAction.Restrict);
                table.CheckConstraint("CK_CharacterCatalogEntries_MetadataRevision", "MetadataRevision >= 1");
            });

        migrationBuilder.CreateTable(
            name: "CatalogAdditionReceipts",
            columns: table => new
            {
                CampaignId = table.Column<int>(type: "int", nullable: false),
                CharacterId = table.Column<Guid>(type: "char(36)", nullable: false),
                RequestId = table.Column<Guid>(type: "char(36)", nullable: false),
                EntryId = table.Column<Guid>(type: "char(36)", nullable: false),
                CatalogEntryId = table.Column<Guid>(type: "char(36)", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CatalogAdditionReceipts", x => new { x.CampaignId, x.CharacterId, x.RequestId });
                table.ForeignKey("FK_CatalogAdditionReceipts_CharacterMetadata_CampaignId_CharacterId", x => new { x.CampaignId, x.CharacterId }, "CharacterMetadata", new[] { "CampaignId", "Id" }, onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(name: "IX_CharacterCatalogEntries_CampaignId_CharacterId_CatalogEntryId", table: "CharacterCatalogEntries", columns: new[] { "CampaignId", "CharacterId", "CatalogEntryId" });
        migrationBuilder.CreateIndex(name: "IX_CharacterCatalogEntries_CampaignId_CatalogEntryId", table: "CharacterCatalogEntries", columns: new[] { "CampaignId", "CatalogEntryId" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "CatalogAdditionReceipts");
        migrationBuilder.DropTable(name: "CharacterCatalogEntries");
    }

    protected override void BuildTargetModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "9.0.11").HasAnnotation("Relational:MaxIdentifierLength", 64);
        modelBuilder.Entity("Tdn.Campaigns.Campaigns.Campaign", entity =>
        {
            entity.Property<int>("Id").ValueGeneratedOnAdd().HasColumnType("int").HasAnnotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn);
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.Property<Guid>("CreationRequestId").HasColumnType("char(36)");
            entity.Property<int>("CreatedByType").HasColumnType("int");
            entity.Property<int>("CreatedById").HasColumnType("int");
            entity.HasKey("Id"); entity.HasIndex("CreationRequestId").IsUnique();
            entity.ToTable("Campaigns", table => table.HasCheckConstraint("CK_Campaigns_MetadataRevision", "MetadataRevision >= 1"));
        });
        modelBuilder.Entity("Tdn.Campaigns.Campaigns.CampaignMember", entity =>
        {
            entity.Property<int>("CampaignId").HasColumnType("int"); entity.Property<int>("UserId").HasColumnType("int");
            entity.Property<bool>("IsAdmin").HasColumnType("tinyint(1)"); entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("CampaignId", "UserId"); entity.HasIndex("UserId");
            entity.ToTable("CampaignMembers", table => table.HasCheckConstraint("CK_CampaignMembers_MetadataRevision", "MetadataRevision >= 1"));
        });
        modelBuilder.Entity("Tdn.Campaigns.Sheets.TemplateMetadata", entity =>
        {
            entity.Property<int>("CampaignId").HasColumnType("int"); entity.Property<string>("Name").IsRequired().HasColumnType("longtext");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint"); entity.HasKey("CampaignId");
            entity.ToTable("CampaignTemplates", table => table.HasCheckConstraint("CK_CampaignTemplates_MetadataRevision", "MetadataRevision >= 1"));
        });
        modelBuilder.Entity("Tdn.Campaigns.Sheets.CharacterMetadata", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("char(36)"); entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext"); entity.Property<int>("Importance").HasColumnType("int");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint"); entity.HasKey("Id"); entity.HasAlternateKey("CampaignId", "Id");
            entity.ToTable("CharacterMetadata", table => table.HasCheckConstraint("CK_CharacterMetadata_MetadataRevision", "MetadataRevision >= 1"));
        });
        modelBuilder.Entity("Tdn.Campaigns.Sheets.CharacterAssignment", entity =>
        {
            entity.Property<int>("CampaignId").HasColumnType("int"); entity.Property<Guid>("CharacterId").HasColumnType("char(36)"); entity.Property<int>("UserId").HasColumnType("int");
            entity.Property<bool>("CanWrite").HasColumnType("tinyint(1)"); entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("CampaignId", "CharacterId", "UserId"); entity.HasIndex("CampaignId", "UserId");
            entity.ToTable("CharacterAssignments", table => table.HasCheckConstraint("CK_CharacterAssignments_MetadataRevision", "MetadataRevision >= 1"));
        });
        modelBuilder.Entity("Tdn.Campaigns.Sheets.FormulaMetadata", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("char(36)"); entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext"); entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("Id"); entity.HasAlternateKey("CampaignId", "Id"); entity.ToTable("FormulaMetadata", table => table.HasCheckConstraint("CK_FormulaMetadata_MetadataRevision", "MetadataRevision >= 1"));
        });
        modelBuilder.Entity("Tdn.Campaigns.Sheets.ViewMetadata", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("char(36)"); entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext"); entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("Id"); entity.HasAlternateKey("CampaignId", "Id"); entity.ToTable("ViewMetadata", table => table.HasCheckConstraint("CK_ViewMetadata_MetadataRevision", "MetadataRevision >= 1"));
        });
        modelBuilder.Entity("Tdn.Campaigns.Catalog.CatalogEntry", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("char(36)"); entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext"); entity.Property<int>("Kind").HasColumnType("int");
            entity.Property<int?>("CreatorUserId").HasColumnType("int"); entity.Property<bool>("IsHidden").HasColumnType("tinyint(1)");
            entity.Property<int?>("QuantityUnit").HasColumnType("int"); entity.Property<bool>("AllowNegative").HasColumnType("tinyint(1)");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint"); entity.HasKey("Id"); entity.HasAlternateKey("CampaignId", "Id");
            entity.HasIndex("CampaignId", "Kind"); entity.ToTable("CatalogEntries", table => table.HasCheckConstraint("CK_CatalogEntries_MetadataRevision", "MetadataRevision >= 1"));
        });
        modelBuilder.Entity("Tdn.Campaigns.Catalog.CharacterCatalogEntry", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("char(36)");
            entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<Guid>("CharacterId").HasColumnType("char(36)");
            entity.Property<Guid>("CatalogEntryId").HasColumnType("char(36)");
            entity.Property<decimal?>("Quantity").HasColumnType("decimal(65,28)");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("Id");
            entity.HasIndex("CampaignId", "CharacterId", "CatalogEntryId");
            entity.HasIndex("CampaignId", "CatalogEntryId");
            entity.ToTable("CharacterCatalogEntries", table => table.HasCheckConstraint("CK_CharacterCatalogEntries_MetadataRevision", "MetadataRevision >= 1"));
        });
        modelBuilder.Entity("Tdn.Campaigns.Catalog.CatalogAdditionReceipt", entity =>
        {
            entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<Guid>("CharacterId").HasColumnType("char(36)");
            entity.Property<Guid>("RequestId").HasColumnType("char(36)");
            entity.Property<Guid>("EntryId").HasColumnType("char(36)");
            entity.Property<Guid>("CatalogEntryId").HasColumnType("char(36)");
            entity.HasKey("CampaignId", "CharacterId", "RequestId");
            entity.ToTable("CatalogAdditionReceipts");
        });
        modelBuilder.Entity("Tdn.Campaigns.Campaigns.CampaignMember", entity => entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign").WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired());
        modelBuilder.Entity("Tdn.Campaigns.Sheets.TemplateMetadata", entity => entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign").WithOne("Template").HasForeignKey("Tdn.Campaigns.Sheets.TemplateMetadata", "CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired());
        modelBuilder.Entity("Tdn.Campaigns.Sheets.CharacterMetadata", entity => entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign").WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired());
        modelBuilder.Entity("Tdn.Campaigns.Sheets.CharacterAssignment", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Sheets.CharacterMetadata", "Character").WithMany().HasForeignKey("CampaignId", "CharacterId").HasPrincipalKey("CampaignId", "Id").OnDelete(DeleteBehavior.Restrict).IsRequired();
            entity.HasOne("Tdn.Campaigns.Campaigns.CampaignMember", "CampaignMember").WithMany().HasForeignKey("CampaignId", "UserId").HasPrincipalKey("CampaignId", "UserId").OnDelete(DeleteBehavior.Restrict).IsRequired();
        });
        modelBuilder.Entity("Tdn.Campaigns.Sheets.FormulaMetadata", entity => entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign").WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired());
        modelBuilder.Entity("Tdn.Campaigns.Sheets.ViewMetadata", entity => entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign").WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired());
        modelBuilder.Entity("Tdn.Campaigns.Catalog.CatalogEntry", entity => entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign").WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired());
        modelBuilder.Entity("Tdn.Campaigns.Catalog.CharacterCatalogEntry", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Sheets.CharacterMetadata", "Character").WithMany().HasForeignKey("CampaignId", "CharacterId").HasPrincipalKey("CampaignId", "Id").OnDelete(DeleteBehavior.Restrict).IsRequired();
            entity.HasOne("Tdn.Campaigns.Catalog.CatalogEntry", "CatalogEntry").WithMany().HasForeignKey("CampaignId", "CatalogEntryId").HasPrincipalKey("CampaignId", "Id").OnDelete(DeleteBehavior.Restrict).IsRequired();
        });
        modelBuilder.Entity("Tdn.Campaigns.Catalog.CatalogAdditionReceipt", entity => entity.HasOne("Tdn.Campaigns.Sheets.CharacterMetadata", null).WithMany().HasForeignKey("CampaignId", "CharacterId").HasPrincipalKey("CampaignId", "Id").OnDelete(DeleteBehavior.Restrict).IsRequired());
    }
}
