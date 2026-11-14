using Microsoft.EntityFrameworkCore;

namespace Tdn.Accounts.Persistence;

public sealed class AccountsDbContext(DbContextOptions<AccountsDbContext> options) : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<ExternalIdentity> ExternalIdentities => Set<ExternalIdentity>();
    protected override void OnModelCreating(ModelBuilder model)
    {
        model.HasCharSet("utf8mb4");
        model.Entity<Account>(e => { e.ToTable("accounts"); e.HasKey(x => x.Id); e.Property(x => x.Id).HasColumnName("Id").ValueGeneratedOnAdd(); });
        model.Entity<ExternalIdentity>(e =>
        {
            e.ToTable("external_identities"); e.HasKey(x => x.Id); e.Property(x => x.Id).ValueGeneratedOnAdd();
            e.Property(x => x.Issuer).HasMaxLength(512).IsRequired().UseCollation("utf8mb4_0900_bin").HasCharSet("utf8mb4");
            e.Property(x => x.Subject).HasMaxLength(255).IsRequired().UseCollation("utf8mb4_0900_bin").HasCharSet("utf8mb4");
            e.HasIndex(x => new { x.Issuer, x.Subject }).IsUnique(); e.HasIndex(x => x.AccountId);
            e.HasOne(x => x.Account).WithMany(x => x.ExternalIdentities).HasForeignKey(x => x.AccountId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
