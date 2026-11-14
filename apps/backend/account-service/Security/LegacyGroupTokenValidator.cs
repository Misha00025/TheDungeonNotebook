using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;
using Tdn.Accounts.Configuration;

namespace Tdn.Accounts.Security;

public sealed record GroupPrincipal(int GroupId, int AccessLevel);

public sealed class LegacyGroupTokenValidator : IDisposable
{
    private readonly LegacyGroupsOptions options;
    private readonly RsaSecurityKey? publicKey;

    public LegacyGroupTokenValidator(LegacyGroupsOptions options)
    {
        this.options = options;
        if (options.Enabled)
        {
            try
            {
                var pem = File.ReadAllText(options.PublicKeyPath!);
                if (pem.Contains("PRIVATE KEY", StringComparison.Ordinal)) throw new InvalidOperationException();
                var rsa = RSA.Create();
                try
                {
                    rsa.ImportFromPem(pem);
                    publicKey = new RsaSecurityKey(rsa);
                }
                catch { rsa.Dispose(); throw; }
            }
            catch { throw new InvalidOperationException("LegacyGroups:PublicKeyPath must reference a valid public RSA key"); }
        }
    }

    public void Dispose() => publicKey?.Rsa?.Dispose();

    public GroupPrincipal? Verify(string token)
    {
        if (!options.Enabled || token.Length > 16384) return null;
        try
        {
            var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
            var parameters = new TokenValidationParameters
            {
                RequireSignedTokens = true,
                RequireExpirationTime = true,
                RequireAudience = true,
                ValidateIssuer = true,
                ValidIssuer = options.Issuer,
                ValidateAudience = true,
                ValidAudience = options.Audience,
                IgnoreTrailingSlashWhenValidatingAudience = false,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(options.ClockSkewSeconds),
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = publicKey,
                ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
                ValidTypes = ["JWT"]
            };
            handler.ValidateToken(token, parameters, out var validated);
            var jwt = (JwtSecurityToken)validated;
            if (jwt.Payload.ContainsKey("userId") || jwt.Payload.ContainsKey("accountId")) return null;
            if (!jwt.Payload.TryGetValue("groupId", out var groupValue) || !TryInt32(groupValue, true, out var groupId) || groupId <= 0) return null;
            if (!jwt.Payload.TryGetValue("sub", out var subjectValue) || subjectValue is not string subject || !StringComparer.Ordinal.Equals(subject, groupId.ToString(CultureInfo.InvariantCulture))) return null;
            if (!jwt.Payload.TryGetValue("access_level", out var accessValue) || !TryInt32(accessValue, false, out var accessLevel) || accessLevel < 0) return null;
            return new GroupPrincipal(groupId, accessLevel);
        }
        catch (SecurityTokenException) { return null; }
        catch (FormatException) { return null; }
        catch (OverflowException) { return null; }
        catch (ArgumentException) { return null; }
    }

    private static bool TryInt32(object? value, bool allowString, out int result)
    {
        if (value is int integer) { result = integer; return true; }
        if (value is long number && number is >= int.MinValue and <= int.MaxValue) { result = (int)number; return true; }
        if (allowString && value is string text && int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out result) && StringComparer.Ordinal.Equals(text, result.ToString(CultureInfo.InvariantCulture))) return true;
        if (!allowString && value is string accessText && int.TryParse(accessText, NumberStyles.Integer, CultureInfo.InvariantCulture, out result)) return true;
        result = 0;
        return false;
    }
}
