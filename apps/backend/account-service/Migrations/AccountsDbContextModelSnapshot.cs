using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Tdn.Accounts.Persistence;

namespace Tdn.Accounts.Migrations;

[DbContext(typeof(AccountsDbContext))]
public sealed class AccountsDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
        modelBuilder.HasAnnotation("ProductVersion", "8.0.8").HasCharSet("utf8mb4");
        modelBuilder.Entity<Account>(b => { b.ToTable("accounts"); b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnType("int").IsRequired().ValueGeneratedOnAdd().HasAnnotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn); });
        modelBuilder.Entity<ExternalIdentity>(b =>
        {
            b.ToTable("external_identities"); b.HasKey(x => x.Id); b.Property(x => x.Id).HasColumnType("bigint").IsRequired().ValueGeneratedOnAdd().HasAnnotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn);
            b.Property(x => x.AccountId).HasColumnType("int").IsRequired(); b.Property(x => x.Issuer).IsRequired().HasMaxLength(512).HasColumnType("varchar(512)").UseCollation("utf8mb4_0900_bin").HasCharSet("utf8mb4");
            b.Property(x => x.Subject).IsRequired().HasMaxLength(255).HasColumnType("varchar(255)").UseCollation("utf8mb4_0900_bin").HasCharSet("utf8mb4");
            b.HasIndex(x => x.AccountId); b.HasIndex(x => new { x.Issuer, x.Subject }).IsUnique();
            b.HasOne(x => x.Account).WithMany(x => x.ExternalIdentities).HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
