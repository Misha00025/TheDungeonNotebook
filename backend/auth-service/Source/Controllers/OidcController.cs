using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Tdn.Configuration;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[Route("")]
[ApiController]
public class OidcController : ControllerBase
{
    private readonly OidcConfig _oidcConfig;
    private readonly LoginContext _dbContext;
    private readonly IConfiguration _configuration;

    public OidcController(OidcConfig oidcConfig, LoginContext dbContext, IConfiguration configuration)
    {
        _oidcConfig = oidcConfig;
        _dbContext = dbContext;
        _configuration = configuration;
    }

    [HttpGet(".well-known/openid-configuration")]
    public ActionResult Discovery()
    {
        var issuer = _oidcConfig.Issuer;
        return Ok(new
        {
            issuer,
            jwks_uri = $"{issuer}/.well-known/jwks.json",
            token_endpoint = $"{issuer}/auth/oauth/token",
            userinfo_endpoint = $"{issuer}/userinfo",
            registration_endpoint = $"{issuer}/auth/clients",
            claims_supported = new[] { "sub", "iss", "iat", "auth_time", "userId", "groupId" },
            id_token_signing_alg_values_supported = new[] { "RS256" },
            response_types_supported = new[] { "token" },
            grant_types_supported = new[] { "client_credentials", "refresh_token" },
            subject_types_supported = new[] { "public" },
            scopes_supported = new[] { "openid", "profile" }
        });
    }

    [HttpGet(".well-known/jwks.json")]
    public ActionResult Jwks()
    {
        var publicKeyPath = _configuration["PUBLIC_KEY_PATH"]
            ?? throw new InvalidOperationException("Public Key Path is missing from environment variables.");
        var publicKeyText = System.IO.File.ReadAllText(publicKeyPath);
        var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyText);
        var key = new RsaSecurityKey(rsa);
        var jwk = RsaKeyHelper.GetJwk(key);

        return Ok(new { keys = new[] { jwk } });
    }

    [HttpGet("userinfo")]
    public ActionResult UserInfo()
    {
        var authHeader = Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            return Unauthorized(new { error = "Missing or invalid Authorization header" });

        var accessToken = authHeader["Bearer ".Length..].Trim();

        var publicKeyPath = _configuration["PUBLIC_KEY_PATH"]
            ?? throw new InvalidOperationException("Public Key Path is missing from environment variables.");
        var publicKeyText = System.IO.File.ReadAllText(publicKeyPath);
        var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyText);
        var publicKey = new RsaSecurityKey(rsa);

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = publicKey,
            ValidateAudience = false,
            ValidateIssuer = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5)
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        try
        {
            var principal = tokenHandler.ValidateToken(accessToken, validationParameters, out _);
            var sub = principal.FindFirst("sub")?.Value
                      ?? principal.FindFirst("userId")?.Value;
            if (sub == null)
                return Unauthorized(new { error = "Token missing sub claim" });

            if (int.TryParse(sub, out var userId))
            {
                var user = _dbContext.Users.Where(e => e.Id == userId).FirstOrDefault();
                if (user != null)
                    return Ok(new { sub, preferred_username = user.Username });
            }

            return Ok(new { sub });
        }
        catch
        {
            return Unauthorized(new { error = "Invalid token" });
        }
    }
}
