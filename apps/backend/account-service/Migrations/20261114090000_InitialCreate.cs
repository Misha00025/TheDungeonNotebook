using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Metadata;
using Tdn.Accounts.Persistence;

namespace Tdn.Accounts.Migrations;

[DbContext(typeof(AccountsDbContext))]
[Migration("20261114090000_InitialCreate")]
public sealed class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterDatabase().Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.CreateTable(name: "accounts", columns: table => new { Id = table.Column<int>(type: "int", nullable: false).Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn) }, constraints: table => table.PrimaryKey("PK_accounts", x => x.Id)).Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.CreateTable(name: "external_identities", columns: table => new
        {
            Id = table.Column<long>(type: "bigint", nullable: false).Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
            AccountId = table.Column<int>(type: "int", nullable: false),
            Issuer = table.Column<string>(type: "varchar(512)", maxLength: 512, nullable: false, collation: "utf8mb4_0900_bin").Annotation("MySql:CharSet", "utf8mb4"),
            Subject = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_0900_bin").Annotation("MySql:CharSet", "utf8mb4")
        }, constraints: table => { table.PrimaryKey("PK_external_identities", x => x.Id); table.ForeignKey("FK_external_identities_accounts_AccountId", x => x.AccountId, "accounts", "Id", onDelete: ReferentialAction.Cascade); }).Annotation("MySql:CharSet", "utf8mb4");
        migrationBuilder.CreateIndex("IX_external_identities_Issuer_Subject", "external_identities", new[] { "Issuer", "Subject" }, unique: true);
        migrationBuilder.CreateIndex("IX_external_identities_AccountId", "external_identities", "AccountId");
    }
    protected override void Down(MigrationBuilder migrationBuilder) { migrationBuilder.DropTable("external_identities"); migrationBuilder.DropTable("accounts"); }
}
