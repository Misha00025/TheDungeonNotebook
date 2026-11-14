using System.Security.Cryptography;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace Tdn.Bff.Sessions;

public sealed class RedisTicketStore : ITicketStore
{
    private readonly ISessionRepository _repository;

    public RedisTicketStore(ISessionRepository repository)
    {
        _repository = repository;
    }

    public async Task<string> StoreAsync(AuthenticationTicket ticket)
    {
        var key = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var storedTicket = AddSessionClaim(ticket, key);
        await _repository.CreateAsync(key, storedTicket, CancellationToken.None).ConfigureAwait(false);
        return key;
    }

    public Task RenewAsync(string key, AuthenticationTicket ticket) => Task.CompletedTask;

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

    private static string Base64UrlEncode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
