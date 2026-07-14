using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace Tdn.Security;

public static class RsaKeyHelper
{
    public static string GetKeyId(RsaSecurityKey key)
    {
        var rsa = key.Rsa ?? throw new InvalidOperationException("RSA key is null");
        var parameters = rsa.ExportParameters(false);
        var modulus = parameters.Modulus ?? throw new InvalidOperationException("Modulus is null");
        using var sha1 = SHA1.Create();
        var hash = sha1.ComputeHash(modulus);
        return Base64UrlEncoder.Encode(hash);
    }

    public static Dictionary<string, object> GetJwk(RsaSecurityKey key)
    {
        var rsa = key.Rsa ?? throw new InvalidOperationException("RSA key is null");
        var parameters = rsa.ExportParameters(false);
        var kid = GetKeyId(key);

        return new Dictionary<string, object>
        {
            ["kty"] = "RSA",
            ["n"] = Base64UrlEncoder.Encode(parameters.Modulus!),
            ["e"] = Base64UrlEncoder.Encode(parameters.Exponent!),
            ["kid"] = kid
        };
    }
}
