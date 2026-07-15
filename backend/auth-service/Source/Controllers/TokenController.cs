using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Tdn.Configuration;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Security;

namespace Tdn.Api.Controllers;

[Route("")]
[ApiController]
public class TokenController : ControllerBase
{
    private readonly IssuerConfig _issuerConfig;
    private readonly LoginContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly Configs _configs;

    public TokenController(IssuerConfig issuerConfig, LoginContext dbContext, IConfiguration configuration, Configs configs)
    {
        _issuerConfig = issuerConfig;
        _dbContext = dbContext;
        _configuration = configuration;
        _configs = configs;
    }

    private RsaSecurityKey GetPublicKey()
    {
        var publicKeyPath = _configuration["PUBLIC_KEY_PATH"]
            ?? throw new InvalidOperationException("Public Key Path is missing from environment variables.");
        var publicKeyText = System.IO.File.ReadAllText(publicKeyPath);
        var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyText);
        return new RsaSecurityKey(rsa);
    }

    private RsaSecurityKey GetPrivateKey()
    {
        var privateKeyPath = _configuration["PRIVATE_KEY_PATH"] ?? throw new InvalidOperationException("Private Key Path is missing from environment variables.");
        var privateKeyText = System.IO.File.ReadAllText(privateKeyPath);
        RSA rsaPrivate = RSA.Create();
        rsaPrivate.ImportFromPem(privateKeyText);
        return new RsaSecurityKey(rsaPrivate);
    }

    private TokenValidationParameters GetValidationParameters()
    {
        return new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = GetPublicKey(),
            ValidateAudience = false,
            ValidateIssuer = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5)
        };
    }

    private string GenerateTokenString(ClaimsIdentity subject, DateTime expires, string audience = "api-gateway")
    {
        var privateKey = GetPrivateKey();

        var claims = new List<Claim>();
        foreach (var c in subject.Claims)
        {
            if (c.Type != "aud" && c.Type != "iat")
                claims.Add(c);
        }
        claims.Add(new Claim("iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(), ClaimValueTypes.Integer64));

        var signingCredentials = new SigningCredentials(privateKey, SecurityAlgorithms.RsaSha256);
        var token = new JwtSecurityToken(
            _issuerConfig.Issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: signingCredentials
        );
        token.Payload["kid"] = RsaKeyHelper.GetKeyId(privateKey);
        token.Payload["typ"] = "JWT";

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    [HttpGet(".well-known/jwks.json")]
    public ActionResult Jwks()
    {
        var key = GetPublicKey();
        var jwk = RsaKeyHelper.GetJwk(key);

        return Ok(new { keys = new[] { jwk } });
    }

    [HttpPost("token")]
    [AllowAnonymous]
    public async Task<ActionResult> ConnectToken()
    {
        var data = await ParseConnectTokenRequest();
        var grantType = data.GetValueOrDefault("grant_type");

        return grantType switch
        {
            "password" => await HandlePasswordGrant(data),
            "refresh_token" => await HandleRefreshTokenGrant(data),
            _ => BadRequest(new { error = "unsupported_grant_type" })
        };
    }

    private async Task<Dictionary<string, string>> ParseConnectTokenRequest()
    {
        if (Request.HasFormContentType)
        {
            var form = await Request.ReadFormAsync();
            return form.ToDictionary(k => k.Key, v => v.Value.ToString());
        }

        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var body = await reader.ReadToEndAsync();
        return JsonSerializer.Deserialize<Dictionary<string, string>>(body) ?? new();
    }

    private async Task<ActionResult> HandlePasswordGrant(Dictionary<string, string> data)
    {
        var username = data.GetValueOrDefault("username");
        var password = data.GetValueOrDefault("password");
        var scope = data.GetValueOrDefault("scope", "openid profile");

        if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password))
            return BadRequest(new { error = "invalid_request", error_description = "username and password are required" });

        var user = _dbContext.Users.Where(e => e.Username == username).FirstOrDefault();
        if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return Unauthorized(new { error = "invalid_grant", error_description = "Invalid credentials" });

        var claims = new List<Claim>
        {
            new("sub", user.Id.ToString()),
            new("userId", user.Id.ToString())
        };

        var accessExpire = DateTime.UtcNow.AddDays(_configs.AccessTokenExpire.Days)
            .AddMinutes(_configs.AccessTokenExpire.Minutes);
        var accessToken = GenerateTokenString(new ClaimsIdentity(claims), accessExpire);

        var result = new Dictionary<string, object>
        {
            ["access_token"] = accessToken,
            ["token_type"] = "Bearer",
            ["expires_in"] = _configs.AccessTokenExpire.Days * 86400 + _configs.AccessTokenExpire.Minutes * 60,
            ["scope"] = scope
        };

        return Ok(result);
    }

    private Task<ActionResult> HandleRefreshTokenGrant(Dictionary<string, string> data)
    {
        var refreshToken = data.GetValueOrDefault("refresh_token");
        var scope = data.GetValueOrDefault("scope", "openid profile");

        if (string.IsNullOrEmpty(refreshToken))
            return Task.FromResult<ActionResult>(BadRequest(new { error = "invalid_request", error_description = "refresh_token is required" }));

        var validationParameters = GetValidationParameters();
        var tokenHandler = new JwtSecurityTokenHandler();

        try
        {
            var principal = tokenHandler.ValidateToken(refreshToken, validationParameters, out _);
            var claims = principal.Claims
                .Where(c => c.Type != "exp" && c.Type != "nbf" && c.Type != "iat")
                .ToList();

            var accessExpire = DateTime.UtcNow.AddDays(_configs.AccessTokenExpire.Days)
                .AddMinutes(_configs.AccessTokenExpire.Minutes);
            var accessToken = GenerateTokenString(new ClaimsIdentity(claims), accessExpire);

            var result = new Dictionary<string, object>
            {
                ["access_token"] = accessToken,
                ["token_type"] = "Bearer",
                ["expires_in"] = _configs.AccessTokenExpire.Days * 86400 + _configs.AccessTokenExpire.Minutes * 60,
                ["scope"] = scope
            };

            return Task.FromResult<ActionResult>(Ok(result));
        }
        catch (SecurityTokenExpiredException)
        {
            return Task.FromResult<ActionResult>(Unauthorized(new { error = "invalid_token", error_description = "Token expired." }));
        }
        catch (SecurityTokenInvalidSignatureException)
        {
            return Task.FromResult<ActionResult>(Unauthorized(new { error = "invalid_token", error_description = "Invalid signature." }));
        }
        catch (Exception ex)
        {
            return Task.FromResult<ActionResult>(Unauthorized(new { error = "invalid_token", error_description = $"Error validating token: {ex.Message}" }));
        }
    }

}
