using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tdn.Accounts.Configuration;
using Tdn.Accounts.Security;

namespace Tdn.Accounts.Persistence;

public sealed class AccountConfigurationValidator(IOptions<OidcOptions> oidc, LegacyGroupsOptions legacy, LegacyGroupTokenValidator legacyValidator, InternalServiceKey key, IOptions<AccountOptions> accounts) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        oidc.Value.Validate();
        legacy.Validate(oidc.Value);
        if (accounts.Value.FirstAccountId < 1) throw new InvalidOperationException("Accounts:FirstAccountId must be positive");
        if (string.IsNullOrEmpty(key.Value)) throw new InvalidOperationException("Internal authentication key is required");
        return Task.CompletedTask;
    }
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

public sealed class AccountInitializer(IServiceScopeFactory scopes, IOptions<AccountOptions> accountOptions) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var first = accountOptions.Value.FirstAccountId;
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AccountsDbContext>();
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await db.Database.MigrateAsync(cancellationToken);
                if (!await db.Accounts.AnyAsync(cancellationToken)) await db.Database.ExecuteSqlRawAsync($"ALTER TABLE accounts AUTO_INCREMENT = {first}", cancellationToken);
                return;
            }
            catch when (attempt < 9) { await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken); }
        }
    }
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
