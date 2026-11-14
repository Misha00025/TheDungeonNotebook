using Microsoft.EntityFrameworkCore;
using MySqlConnector;
using Tdn.Accounts.Security;

namespace Tdn.Accounts.Persistence;

public interface IAccountStore
{
    Task<int> ResolveOrCreateAsync(VerifiedIdentity identity, CancellationToken cancellationToken);
}

public sealed class AccountStore(AccountsDbContext db) : IAccountStore
{
    public async Task<int> ResolveOrCreateAsync(VerifiedIdentity identity, CancellationToken cancellationToken)
    {
        var found = await Find(identity, cancellationToken);
        if (found.HasValue) return found.Value;
        for (var attempt = 0; attempt < 3; attempt++)
        {
            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                var account = new Account(); db.Accounts.Add(account); await db.SaveChangesAsync(cancellationToken);
                db.ExternalIdentities.Add(new ExternalIdentity { AccountId = account.Id, Issuer = identity.Issuer, Subject = identity.Subject });
                await db.SaveChangesAsync(cancellationToken); await tx.CommitAsync(cancellationToken); return account.Id;
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                await tx.RollbackAsync(cancellationToken); db.ChangeTracker.Clear();
                var winner = await Find(identity, cancellationToken);
                if (winner.HasValue) return winner.Value;
                throw;
            }
            catch (Exception ex) when (attempt < 2 && IsTransientLock(ex))
            {
                await tx.RollbackAsync(cancellationToken); db.ChangeTracker.Clear();
                await Task.Delay(25 * (attempt + 1), cancellationToken);
            }
        }
        throw new InvalidOperationException();
    }
    private Task<int?> Find(VerifiedIdentity identity, CancellationToken ct) => db.ExternalIdentities.AsNoTracking().Where(x => x.Issuer == identity.Issuer && x.Subject == identity.Subject).Select(x => (int?)x.AccountId).SingleOrDefaultAsync(ct);

    private static bool IsUniqueViolation(Exception exception) => GetExceptionChain(exception).Any(e => e is MySqlException mysql && mysql.Number == 1062 || IsSqliteUniqueViolation(e));
    private static bool IsTransientLock(Exception exception) => GetExceptionChain(exception).Any(e => e is MySqlException mysql && mysql.Number is 1205 or 1213);
    private static bool IsSqliteUniqueViolation(Exception exception) => exception.GetType().FullName == "Microsoft.Data.Sqlite.SqliteException" && Convert.ToInt32(exception.GetType().GetProperty("SqliteErrorCode")?.GetValue(exception)) == 19;
    private static IEnumerable<Exception> GetExceptionChain(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
            yield return current;
    }
}
