using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Pomelo.EntityFrameworkCore.MySql.Metadata;
using Tdn.Campaigns.Persistence;

namespace Tdn.Campaigns.Persistence.Migrations;

[DbContext(typeof(CampaignDbContext))]
[Migration("20261117000300_TemplatesCharacters")]
public sealed class TemplatesCharacters : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "TemplateMetadata",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false),
                CampaignId = table.Column<int>(type: "int", nullable: false),
                Name = table.Column<string>(type: "longtext", nullable: false),
                MetadataRevision = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_TemplateMetadata", x => x.Id);
                table.UniqueConstraint("AK_TemplateMetadata_CampaignId_Id", x => new { x.CampaignId, x.Id });
                table.ForeignKey("FK_TemplateMetadata_Campaigns_CampaignId", x => x.CampaignId, "Campaigns", "Id", onDelete: ReferentialAction.Restrict);
                table.CheckConstraint("CK_TemplateMetadata_MetadataRevision", "MetadataRevision >= 1");
            });

        migrationBuilder.CreateTable(
            name: "CharacterMetadata",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false),
                CampaignId = table.Column<int>(type: "int", nullable: false),
                TemplateId = table.Column<Guid>(type: "char(36)", nullable: false),
                Name = table.Column<string>(type: "longtext", nullable: false),
                Importance = table.Column<int>(type: "int", nullable: false),
                MetadataRevision = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CharacterMetadata", x => x.Id);
                table.UniqueConstraint("AK_CharacterMetadata_CampaignId_Id", x => new { x.CampaignId, x.Id });
                table.ForeignKey("FK_CharacterMetadata_Campaigns_CampaignId", x => x.CampaignId, "Campaigns", "Id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_CharacterMetadata_TemplateMetadata_CampaignId_TemplateId", x => new { x.CampaignId, x.TemplateId }, "TemplateMetadata", new[] { "CampaignId", "Id" }, onDelete: ReferentialAction.Restrict);
                table.CheckConstraint("CK_CharacterMetadata_MetadataRevision", "MetadataRevision >= 1");
            });

        migrationBuilder.CreateTable(
            name: "CharacterAssignments",
            columns: table => new
            {
                CampaignId = table.Column<int>(type: "int", nullable: false),
                CharacterId = table.Column<Guid>(type: "char(36)", nullable: false),
                UserId = table.Column<int>(type: "int", nullable: false),
                CanWrite = table.Column<bool>(type: "tinyint(1)", nullable: false),
                MetadataRevision = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CharacterAssignments", x => new { x.CampaignId, x.CharacterId, x.UserId });
                table.ForeignKey("FK_CharacterAssignments_CampaignMembers_CampaignId_UserId", x => new { x.CampaignId, x.UserId }, "CampaignMembers", new[] { "CampaignId", "UserId" }, onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_CharacterAssignments_CharacterMetadata_CampaignId_CharacterId", x => new { x.CampaignId, x.CharacterId }, "CharacterMetadata", new[] { "CampaignId", "Id" }, onDelete: ReferentialAction.Restrict);
                table.CheckConstraint("CK_CharacterAssignments_MetadataRevision", "MetadataRevision >= 1");
            });

        migrationBuilder.CreateIndex("IX_CharacterAssignments_CampaignId_UserId", "CharacterAssignments", new[] { "CampaignId", "UserId" });
        migrationBuilder.CreateIndex("IX_CharacterMetadata_CampaignId_TemplateId", "CharacterMetadata", new[] { "CampaignId", "TemplateId" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("CharacterAssignments");
        migrationBuilder.DropTable("CharacterMetadata");
        migrationBuilder.DropTable("TemplateMetadata");
    }

    protected override void BuildTargetModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "9.0.11")
            .HasAnnotation("Relational:MaxIdentifierLength", 64);

        modelBuilder.Entity("Tdn.Campaigns.Campaigns.Campaign", entity =>
        {
            entity.Property<int>("Id").ValueGeneratedOnAdd().HasColumnType("int")
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

        modelBuilder.Entity("Tdn.Campaigns.Sheets.TemplateMetadata", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("char(36)");
            entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("Id");
            entity.HasAlternateKey("CampaignId", "Id");
            entity.ToTable("TemplateMetadata", table => table.HasCheckConstraint("CK_TemplateMetadata_MetadataRevision", "MetadataRevision >= 1"));
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.CharacterMetadata", entity =>
        {
            entity.Property<Guid>("Id").ValueGeneratedOnAdd().HasColumnType("char(36)");
            entity.Property<int>("CampaignId").HasColumnType("int");
            entity.Property<Guid>("TemplateId").HasColumnType("char(36)");
            entity.Property<string>("Name").IsRequired().HasColumnType("longtext");
            entity.Property<int>("Importance").HasColumnType("int");
            entity.Property<long>("MetadataRevision").IsConcurrencyToken().HasColumnType("bigint");
            entity.HasKey("Id");
            entity.HasAlternateKey("CampaignId", "Id");
            entity.HasIndex("CampaignId", "TemplateId");
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

        modelBuilder.Entity("Tdn.Campaigns.Campaigns.CampaignMember", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign")
                .WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired();
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.TemplateMetadata", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign")
                .WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired();
        });

        modelBuilder.Entity("Tdn.Campaigns.Sheets.CharacterMetadata", entity =>
        {
            entity.HasOne("Tdn.Campaigns.Campaigns.Campaign", "Campaign")
                .WithMany().HasForeignKey("CampaignId").OnDelete(DeleteBehavior.Restrict).IsRequired();
            entity.HasOne("Tdn.Campaigns.Sheets.TemplateMetadata", "Template")
                .WithMany().HasForeignKey("CampaignId", "TemplateId")
                .HasPrincipalKey("CampaignId", "Id").OnDelete(DeleteBehavior.Restrict).IsRequired();
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
    }
}
