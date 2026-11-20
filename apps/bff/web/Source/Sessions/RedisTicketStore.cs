using System.Security.Cryptography;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Tdn.Bff.Errors;

namespace Tdn.Bff.Sessions;

public sealed class RedisTicketStore : ITicketStore
{
    private readonly ISessionRepository _repository;
    private readonly ISessionLock _sessionLock;
    private readonly TimeProvider _timeProvider;

    public RedisTicketStore(ISessionRepository repository, ISessionLock sessionLock, TimeProvider timeProvider)
    {
        _repository = repository;
        _sessionLock = sessionLock;
        _timeProvider = timeProvider;
    }

    public async Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        var key = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var storedTicket = AddSessionClaim(ticket, key);
        await _repository.CreateAsync(key, storedTicket, CancellationToken.None).ConfigureAwait(false);
        return key;
    }

    public Task RenewAsync(string key, AuthenticationTicket ticket) => RenewCoreAsync(key, ticket, CancellationToken.None);

    public Task RenewAsync(string key, AuthenticationTicket ticket, HttpContext httpContext, CancellationToken cancellationToken) =>
        RenewCoreAsync(key, ticket, cancellationToken);

    private async Task RenewCoreAsync(string key, AuthenticationTicket ticket, CancellationToken cancellationToken)
    {
        ISessionLockLease lease;
        try
        {
            lease = await _sessionLock.AcquireAsync(key, cancellationToken).ConfigureAwait(false);
        }
        catch (TimeoutException exception)
        {
            throw new DependencyUnavailableException(exception);
        }

        await using (lease.ConfigureAwait(false))
        using (var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lease.HandleLostToken))
        {
            try
            {
                while (true)
                {
                    linkedCancellation.Token.ThrowIfCancellationRequested();
                    var snapshot = await _repository.GetAsync(key, linkedCancellation.Token).ConfigureAwait(false);
                    var now = _timeProvider.GetUtcNow();
                    if (snapshot is null || snapshot.Ticket.Properties.ExpiresUtc is not { } storedExpiry || storedExpiry <= now)
                        return;

                    var incomingExpiry = ticket.Properties.ExpiresUtc;
                    var shouldExtend = incomingExpiry is { } expiry && expiry > storedExpiry;
                    if (!shouldExtend && snapshot.Ticket.Properties.IsPersistent == true)
                        return;

                    var replacement = CloneTicket(snapshot.Ticket);
                    if (shouldExtend)
                    {
                        replacement.Properties.IssuedUtc = ticket.Properties.IssuedUtc;
                        replacement.Properties.ExpiresUtc = incomingExpiry;
                    }
                    replacement.Properties.IsPersistent = true;
                    if (await _repository.ReplaceAsync(key, snapshot, replacement, linkedCancellation.Token).ConfigureAwait(false))
                        return;
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (OperationCanceledException exception)
            {
                throw new DependencyUnavailableException(exception);
            }
        }
    }

    public async Task<AuthenticationTicket?> RetrieveAsync(string key)
    {
        var snapshot = await _repository.GetAsync(key, CancellationToken.None).ConfigureAwait(false);
        return snapshot?.Ticket;
    }

    public Task RemoveAsync(string key) => _repository.DeleteAsync(key, CancellationToken.None);

    private static AuthenticationTicket AddSessionClaim(AuthenticationTicket ticket, string key)
    {
        var principal = new ClaimsPrincipal(ticket.Principal.Identities.Select(identity => identity.Clone()));
        var identities = principal.Identities.ToArray();
        foreach (var claimIdentity in identities)
        {
            foreach (var claim in claimIdentity.FindAll(BffAuthenticationDefaults.SessionClaim).ToArray())
                claimIdentity.RemoveClaim(claim);
        }
        var identity = identities.FirstOrDefault() ?? throw new ArgumentException("Ticket principal must contain an identity.", nameof(ticket));
        identity.AddClaim(new Claim(BffAuthenticationDefaults.SessionClaim, key));
        var properties = ticket.Properties.Clone();
        return new AuthenticationTicket(principal, properties, ticket.AuthenticationScheme);
    }

    private static AuthenticationTicket CloneTicket(AuthenticationTicket ticket) =>
        new(ticket.Principal.Clone(), ticket.Properties.Clone(), ticket.AuthenticationScheme);

    private static string Base64UrlEncode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
