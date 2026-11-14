using Microsoft.AspNetCore.Authentication;

namespace Tdn.Bff.Sessions;

public interface ISessionRepository
{
    Task<SessionSnapshot?> GetAsync(string key, CancellationToken cancellationToken);
    Task CreateAsync(string key, AuthenticationTicket ticket, CancellationToken cancellationToken);
    Task<bool> ReplaceAsync(string key, SessionSnapshot expectedSnapshot, AuthenticationTicket replacementTicket, CancellationToken cancellationToken);
    Task<bool> DeleteIfUnchangedAsync(string key, SessionSnapshot expectedSnapshot, CancellationToken cancellationToken);
    Task DeleteAsync(string key, CancellationToken cancellationToken);
}
