using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Tdn.Campaigns.Persistence;

namespace Tdn.Campaigns.Persistence.Migrations;

[DbContext(typeof(CampaignDbContext))]
[Migration("20261126000100_WorldMaterials")]
public sealed class WorldMaterials : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "WorldMaterials",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "char(36)", nullable: false),
                CampaignId = table.Column<int>(type: "int", nullable: false),
                Kind = table.Column<string>(type: "varchar(32)", nullable: false),
                Title = table.Column<string>(type: "longtext", nullable: false),
                Description = table.Column<string>(type: "longtext", nullable: false),
                Tags = table.Column<string>(type: "longtext", nullable: false),
                IsPublished = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                MetadataRevision = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_WorldMaterials", x => x.Id);
                table.UniqueConstraint("AK_WorldMaterials_CampaignId_Id", x => new { x.CampaignId, x.Id });
                table.ForeignKey("FK_WorldMaterials_Campaigns_CampaignId", x => x.CampaignId, "Campaigns", "Id", onDelete: ReferentialAction.Restrict);
                table.CheckConstraint("CK_WorldMaterials_MetadataRevision", "MetadataRevision >= 1");
            });
        migrationBuilder.CreateIndex(name: "IX_WorldMaterials_CampaignId_Kind", table: "WorldMaterials", columns: new[] { "CampaignId", "Kind" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "WorldMaterials");

    protected override void BuildTargetModel(ModelBuilder modelBuilder) => CampaignDbContextModelSnapshot.BuildFrozenModel(modelBuilder);
}
