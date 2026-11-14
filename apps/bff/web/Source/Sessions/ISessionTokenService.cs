namespace Tdn.Bff.Sessions;

public interface ISessionTokenService
{
    Task<string> GetAccessTokenAsync(string sessionKey, CancellationToken cancellationToken);
}
