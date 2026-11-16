namespace Tdn.Bff.Oidc;

public interface ILogoutRedirectStore
{
    Task<string> StoreAsync(string redirectUrl, CancellationToken cancellationToken);
    Task<string?> TakeAsync(string request, CancellationToken cancellationToken);
}
