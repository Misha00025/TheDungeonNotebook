using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using StackExchange.Redis;
using Tdn.Bff.Configuration;

namespace Tdn.Bff.Oidc;

public sealed class RedisLogoutRedirectStore : ILogoutRedirectStore
{
    private readonly IDatabase _database;
    private readonly IDataProtector _protector;
    private readonly BffOptions _options;

    public RedisLogoutRedirectStore(IConnectionMultiplexer connection, IDataProtectionProvider dataProtectionProvider, IOptions<BffOptions> options)
    {
        _database = connection.GetDatabase();
        _protector = dataProtectionProvider.CreateProtector("Tdn.Bff.LogoutRedirect");
        _options = options.Value;
    }

    public async Task<string> StoreAsync(string redirectUrl, CancellationToken cancellationToken)
    {
        var protectedValue = _protector.Protect(Encoding.UTF8.GetBytes(redirectUrl));
        while (true)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var request = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
            var key = $"{_options.Redis.KeyPrefix}logout:{request}";
            if (await _database.StringSetAsync(key, protectedValue, _options.Logout.RequestLifetime, When.NotExists).ConfigureAwait(false))
                return request;
        }
    }

    public async Task<string?> TakeAsync(string request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var key = $"{_options.Redis.KeyPrefix}logout:{request}";
        var value = await _database.StringGetDeleteAsync(key).ConfigureAwait(false);
        if (value.IsNullOrEmpty)
            return null;
        try
        {
            return Encoding.UTF8.GetString(_protector.Unprotect((byte[])value!));
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    private static string Base64UrlEncode(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
