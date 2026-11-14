using System.Globalization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.Options;
using Tdn.Bff.Configuration;
using Tdn.Bff.Errors;
using Tdn.Bff.Oidc;

namespace Tdn.Bff.Sessions;

public sealed class SessionTokenService : ISessionTokenService
{
    private readonly ISessionRepository _repository;
    private readonly ISessionLock _sessionLock;
    private readonly IOidcTokenClient _tokenClient;
    private readonly IOptionsMonitor<OpenIdConnectOptions> _oidcOptions;
    private readonly IOptions<BffOptions> _bffOptions;
    private readonly TimeProvider _timeProvider;

    public SessionTokenService(
        ISessionRepository repository,
        ISessionLock sessionLock,
        IOidcTokenClient tokenClient,
        IOptionsMonitor<OpenIdConnectOptions> oidcOptions,
        IOptions<BffOptions> bffOptions,
        TimeProvider timeProvider)
    {
        _repository = repository;
        _sessionLock = sessionLock;
        _tokenClient = tokenClient;
        _oidcOptions = oidcOptions;
        _bffOptions = bffOptions;
        _timeProvider = timeProvider;
    }

    public async Task<string> GetAccessTokenAsync(string sessionKey, CancellationToken cancellationToken)
    {
        var snapshot = await ReadSnapshotAsync(sessionKey, cancellationToken).ConfigureAwait(false);
        var now = _timeProvider.GetUtcNow();
        var access = ReadAccess(snapshot.Ticket);
        if (access.ExpiresAt > now + _bffOptions.Value.Session.RefreshBeforeExpiry)
            return access.Token;

        ISessionLockLease lease;
        try
        {
            lease = await _sessionLock.AcquireAsync(sessionKey, cancellationToken).ConfigureAwait(false);
        }
        catch (TimeoutException exception)
        {
            throw new DependencyUnavailableException(exception);
        }

        await using (lease.ConfigureAwait(false))
        {
            using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lease.HandleLostToken);
            try
            {
                snapshot = await ReadSnapshotAsync(sessionKey, linkedCancellation.Token).ConfigureAwait(false);
                now = _timeProvider.GetUtcNow();
                access = ReadAccess(snapshot.Ticket);
                if (access.ExpiresAt > now + _bffOptions.Value.Session.RefreshBeforeExpiry)
                    return access.Token;

                var refreshToken = snapshot.Ticket.Properties.GetTokenValue("refresh_token");
                if (string.IsNullOrEmpty(refreshToken))
                {
                    if (access.ExpiresAt > now)
                        return access.Token;
                    linkedCancellation.Token.ThrowIfCancellationRequested();
                    if (await _repository.DeleteIfUnchangedAsync(sessionKey, snapshot, linkedCancellation.Token).ConfigureAwait(false))
                        throw new AuthenticationRequiredException();
                    return await ResolveConditionalDeleteRaceAsync(sessionKey, linkedCancellation.Token).ConfigureAwait(false);
                }

                var response = await _tokenClient.RefreshAsync(_oidcOptions.Get(BffAuthenticationDefaults.Oidc), refreshToken, linkedCancellation.Token).ConfigureAwait(false);
                if (!response.IsSuccess)
                {
                    if (response.IsInvalidGrant)
                    {
                        linkedCancellation.Token.ThrowIfCancellationRequested();
                        if (await _repository.DeleteIfUnchangedAsync(sessionKey, snapshot, linkedCancellation.Token).ConfigureAwait(false))
                            throw new AuthenticationRequiredException();
                        return await ResolveConditionalDeleteRaceAsync(sessionKey, linkedCancellation.Token).ConfigureAwait(false);
                    }
                    throw new DependencyUnavailableException();
                }

                if (string.IsNullOrWhiteSpace(response.AccessToken) || response.ExpiresIn is <= 0)
                    throw new DependencyUnavailableException();

                var expiresIn = response.ExpiresIn ?? (long)_bffOptions.Value.Session.AccessTokenLifetimeWhenMissing.TotalSeconds;
                if (expiresIn <= 0)
                    throw new DependencyUnavailableException();
                var replacement = CloneTicket(snapshot.Ticket);
                DateTimeOffset accessExpiresAt;
                try
                {
                    accessExpiresAt = _timeProvider.GetUtcNow().AddSeconds(expiresIn);
                }
                catch (ArgumentOutOfRangeException exception)
                {
                    throw new DependencyUnavailableException(exception);
                }
                catch (OverflowException exception)
                {
                    throw new DependencyUnavailableException(exception);
                }
                var rotatedRefreshToken = response.RefreshToken is { Length: > 0 } rotated ? rotated : refreshToken;
                StoreRefreshedTokens(replacement.Properties, response.AccessToken, rotatedRefreshToken, accessExpiresAt);
                linkedCancellation.Token.ThrowIfCancellationRequested();

                if (await _repository.ReplaceAsync(sessionKey, snapshot, replacement, linkedCancellation.Token).ConfigureAwait(false))
                    return response.AccessToken;

                var current = await _repository.GetAsync(sessionKey, linkedCancellation.Token).ConfigureAwait(false);
                if (current is null)
                    throw new AuthenticationRequiredException();
                var currentAccess = TryReadAccess(current.Ticket);
                if (currentAccess is { } valid && valid.ExpiresAt > _timeProvider.GetUtcNow() + _bffOptions.Value.Session.RefreshBeforeExpiry)
                    return valid.Token;
                throw new DependencyUnavailableException();
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

    private async Task<SessionSnapshot> ReadSnapshotAsync(string key, CancellationToken cancellationToken)
    {
        var snapshot = await _repository.GetAsync(key, cancellationToken).ConfigureAwait(false);
        if (snapshot is null || snapshot.Ticket.Properties.ExpiresUtc is not { } expiresUtc || expiresUtc <= _timeProvider.GetUtcNow())
            throw new AuthenticationRequiredException();
        return snapshot;
    }

    private async Task<string> ResolveConditionalDeleteRaceAsync(string key, CancellationToken cancellationToken)
    {
        var current = await _repository.GetAsync(key, cancellationToken).ConfigureAwait(false);
        if (current is null)
            throw new AuthenticationRequiredException();
        var currentAccess = TryReadAccess(current.Ticket);
        if (currentAccess is { } valid && valid.ExpiresAt > _timeProvider.GetUtcNow())
            return valid.Token;
        throw new DependencyUnavailableException();
    }

    private (string Token, DateTimeOffset ExpiresAt) ReadAccess(AuthenticationTicket ticket) =>
        TryReadAccess(ticket) ?? throw new AuthenticationRequiredException();

    private static (string Token, DateTimeOffset ExpiresAt)? TryReadAccess(AuthenticationTicket ticket)
    {
        var token = ticket.Properties.GetTokenValue("access_token");
        var expiresAtValue = ticket.Properties.GetTokenValue("expires_at");
        if (string.IsNullOrWhiteSpace(token) || !DateTimeOffset.TryParse(expiresAtValue, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var expiresAt))
            return null;
        return (token, expiresAt);
    }

    private static AuthenticationTicket CloneTicket(AuthenticationTicket ticket) =>
        new(ticket.Principal.Clone(), ticket.Properties.Clone(), ticket.AuthenticationScheme);

    private static void StoreRefreshedTokens(AuthenticationProperties properties, string accessToken, string refreshToken, DateTimeOffset expiresAt)
    {
        var tokens = properties.GetTokens()
            .Where(token => token.Name is not "access_token" and not "refresh_token" and not "expires_at")
            .ToList();
        tokens.Add(new AuthenticationToken { Name = "access_token", Value = accessToken });
        tokens.Add(new AuthenticationToken { Name = "refresh_token", Value = refreshToken });
        tokens.Add(new AuthenticationToken { Name = "expires_at", Value = expiresAt.ToString("O", CultureInfo.InvariantCulture) });
        properties.StoreTokens(tokens);
    }
}
