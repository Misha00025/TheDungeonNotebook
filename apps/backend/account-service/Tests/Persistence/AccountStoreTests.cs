using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Tdn.Accounts.Persistence;
using Tdn.Accounts.Security;
using Xunit;

namespace Tdn.Accounts.Tests.Persistence;

public sealed class AccountStoreTests
{
    [Fact]
    public async Task Identity_is_reused_and_database_enforces_ordinal_unique_bindings()
    {
        await using var connection = Open();
        var options = new DbContextOptionsBuilder<AccountsDbContext>().UseSqlite(connection).Options;
        await using var db = new AccountsDbContext(options);
        await db.Database.EnsureCreatedAsync();
        var store = new AccountStore(db);
        var first = await store.ResolveOrCreateAsync(new("issuer", "subject"), default);
        Assert.Equal(first, await store.ResolveOrCreateAsync(new("issuer", "subject"), default));
        Assert.NotEqual(first, await store.ResolveOrCreateAsync(new("issuer", "Subject"), default));
        Assert.NotEqual(first, await store.ResolveOrCreateAsync(new("Issuer", "subject"), default));
        await Assert.ThrowsAsync<DbUpdateException>(async () =>
        {
            db.ExternalIdentities.Add(new ExternalIdentity { AccountId = first, Issuer = "issuer", Subject = "subject" });
            await db.SaveChangesAsync();
        });
        Assert.Equal(3, await db.Accounts.CountAsync());
    }

    [Fact]
    public async Task Existing_account_can_have_multiple_external_bindings()
    {
        await using var connection = Open();
        var options = new DbContextOptionsBuilder<AccountsDbContext>().UseSqlite(connection).Options;
        await using var db = new AccountsDbContext(options);
        await db.Database.EnsureCreatedAsync();
        var account = new Account { ExternalIdentities = [new() { Issuer = "issuer-a", Subject = "subject" }, new() { Issuer = "issuer-b", Subject = "subject" }] };
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        Assert.Equal(2, await db.ExternalIdentities.CountAsync(x => x.AccountId == account.Id));
    }

    [Fact]
    public async Task Failed_identity_save_rolls_back_account_insert()
    {
        await using var connection = Open();
        var options = new DbContextOptionsBuilder<AccountsDbContext>().UseSqlite(connection).AddInterceptors(new FailIdentitySave()).Options;
        await using var db = new AccountsDbContext(options);
        await db.Database.EnsureCreatedAsync();
        await Assert.ThrowsAsync<InvalidOperationException>(() => new AccountStore(db).ResolveOrCreateAsync(new("issuer", "subject"), default));
        Assert.Equal(0, await db.Accounts.CountAsync());
        Assert.Equal(0, await db.ExternalIdentities.CountAsync());
    }

    [Fact]
    public async Task Model_and_migration_define_only_account_and_identity_data()
    {
        await using var connection = Open();
        var options = new DbContextOptionsBuilder<AccountsDbContext>().UseSqlite(connection).Options;
        await using var db = new AccountsDbContext(options);
        await db.Database.EnsureCreatedAsync();
        var tables = await db.Database.SqlQueryRaw<string>("SELECT name AS Value FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").ToListAsync();
        Assert.Contains("accounts", tables);
        Assert.Contains("external_identities", tables);
        Assert.Equal(2, tables.Count);
        Assert.DoesNotContain(db.Model.GetEntityTypes(), e => e.GetProperties().Any(p => p.Name.Contains("Email", StringComparison.OrdinalIgnoreCase) || p.Name.Contains("Password", StringComparison.OrdinalIgnoreCase) || p.Name.Contains("Name", StringComparison.OrdinalIgnoreCase)));
        var identity = db.Model.FindEntityType(typeof(ExternalIdentity))!;
        Assert.Contains(identity.GetIndexes(), i => i.IsUnique && i.Properties.Select(p => p.Name).SequenceEqual(["Issuer", "Subject"]));
        Assert.Contains(identity.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(Account) && fk.Properties.Single().Name == "AccountId");
        Assert.Contains("20261114090000_InitialCreate", db.Database.GetMigrations());
    }

    private static SqliteConnection Open()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        connection.Open();
        connection.CreateCollation("utf8mb4_0900_bin", (left, right) => string.CompareOrdinal(left, right));
        return connection;
    }

    private sealed class FailIdentitySave : SaveChangesInterceptor
    {
        public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result) =>
            eventData.Context!.ChangeTracker.Entries<ExternalIdentity>().Any() ? throw new InvalidOperationException("synthetic failure") : result;
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default) =>
            eventData.Context!.ChangeTracker.Entries<ExternalIdentity>().Any() ? ValueTask.FromException<InterceptionResult<int>>(new InvalidOperationException("synthetic failure")) : ValueTask.FromResult(result);
    }
}
