using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Pomelo.EntityFrameworkCore.MySql.Metadata;
using Tdn.Campaigns.Persistence;

namespace Tdn.Campaigns.Persistence.Migrations;

[DbContext(typeof(CampaignDbContext))]
[Migration("20261118000100_CampaignTemplate")]
public sealed class CampaignTemplate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_CharacterMetadata_TemplateMetadata_CampaignId_TemplateId",
            table: "CharacterMetadata");

        migrationBuilder.DropIndex(
            name: "IX_CharacterMetadata_CampaignId_TemplateId",
            table: "CharacterMetadata");

        migrationBuilder.DropColumn(
            name: "TemplateId",
            table: "CharacterMetadata");

        migrationBuilder.DropTable(name: "TemplateMetadata");

        migrationBuilder.CreateTable(
            name: "CampaignTemplates",
            columns: table => new
            {
                CampaignId = table.Column<int>(type: "int", nullable: false),
                Name = table.Column<string>(type: "longtext", nullable: false),
                MetadataRevision = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CampaignTemplates", x => x.CampaignId);
                table.ForeignKey("FK_CampaignTemplates_Campaigns_CampaignId", x => x.CampaignId, "Campaigns", "Id", onDelete: ReferentialAction.Restrict);
                table.CheckConstraint("CK_CampaignTemplates_MetadataRevision", "MetadataRevision >= 1");
            });

        migrationBuilder.Sql("INSERT INTO `CampaignTemplates` (`CampaignId`, `Name`, `MetadataRevision`) SELECT `Id`, `Name`, 1 FROM `Campaigns`;");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        throw new NotSupportedException("The previous many-template data was discarded and cannot be restored automatically.");
    }

    protected override void BuildTargetModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "9.0.11")
            .HasAnnotation("Relational:MaxIdentifierLength", 64);

        modelBuilder.Entity("Tdn.Campaigns.Campaigns.Campaign", entity =>
        {
            entity.Property<int>("Id").ValueGeneratedOnAdd()
                .HasColumnType("int")
                .HasAnnotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn);
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.Property<Guid>("CreationRequestId").HasColumnType("char(36)");
            entity.Property<int>("CreatedByType").HasColumnType("int");
            entity.Property<int>("CreatedById").HasColumnType("int");
            entity.HasKey("Id");
            entity.HasIndex("CreationRequestId").IsUnique();
            entity.ToTable("Campaigns", table => table.HasCheckConstraint("CK_Campaigns_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity("Tdn.Campaigns.Campaigns.CampaignMember", entity =>
        {
            entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<int>("UserId").HasColumnType("int");
            entity.Property<bool>("IsAdmin").HasColumnType("tinyint(1)");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("CampaignId", "UserId");
            entity.HasIndex("UserId");
            entity.ToTable("CampaignMembers", table => table.HasCheckConstraint("CK_CampaignMembers_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity("Tdn.Campaigns.Campaigns.CampaignMember", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign")
                .WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired();
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.TemplateMetadata", entity =>
        {
            entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("CampaignId");
            entity.ToTable("CampaignTemplates", table => table.HasCheckConstraint("CK_CampaignTemplates_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.CharacterMetadata", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("char(36)");
            entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext");
            entity.Property<int>("Importance").HasColumnType("int");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("Id");
            entity.HasAlternateKey("CampaignId", "Id");
            entity.ToTable("CharacterMetadata", table => table.HasCheckConstraint("CK_CharacterMetadata_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.CharacterAssignment", entity =>
        {
            entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<Guid>("CharacterId").HasColumnType("char(36)");
            entity.Property<int>("UserId").HasColumnType("int");
            entity.Property<bool>("CanWrite").HasColumnType("tinyint(1)");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("CampaignId", "CharacterId", "UserId");
            entity.HasIndex("CampaignId", "UserId");
            entity.ToTable("CharacterAssignments", table => table.HasCheckConstraint("CK_CharacterAssignments_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.FormulaMetadata", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("char(36)");
            entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("Id");
            entity.HasAlternateKey("CampaignId", "Id");
            entity.ToTable("FormulaMetadata", table => table.HasCheckConstraint("CK_FormulaMetadata_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.ViewMetadata", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("char(36)");
            entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("Id");
            entity.HasAlternateKey("CampaignId", "Id");
            entity.ToTable("ViewMetadata", table => table.HasCheckConstraint("CK_ViewMetadata_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.TemplateMetadata", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign")
                .WithOne("Template").HasForeignKey("Tdn.Campaigns.Sheets.TemplateMetadata", "CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired();
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.CharacterMetadata", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign")
                .WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired();
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.CharacterAssignment", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Sheets.CharacterMetadata", "Character")
                .WithMany().HasForeignKey("CampaignId", "CharacterId")
                .HasPrincipalKey("CampaignId", "Id").OnDelete(DeleteBehavior.Restrict).IsRequired();
            entity.HasOne("Tdn.Campaigns.Campaigns.CampaignMember", "CampaignMember")
                .WithMany().HasForeignKey("CampaignId", "UserId")
                .HasPrincipalKey("CampaignId", "UserId").OnDelete(DeleteBehavior.Restrict).IsRequired();
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.FormulaMetadata", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign")
                .WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired();
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.ViewMetadata", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign")
                .WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired();
        });
    }
}
