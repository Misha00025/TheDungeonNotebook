using System.Net.Http;
using System.Net.Sockets;

namespace Tdn.Bff.Oidc;

internal static class OidcTransportFailure
{
    public static bool IsTransportFailure(Exception? exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is HttpRequestException or SocketException or TimeoutException or OperationCanceledException)
                return true;
        }

        return false;
    }
}
