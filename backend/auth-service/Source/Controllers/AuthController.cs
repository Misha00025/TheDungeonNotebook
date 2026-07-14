using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using StackExchange.Redis;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Tdn.Configuration;
using Tdn.Security;
using Tdn.Services;

namespace Tdn.Api.Controllers
{
    [Route("auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly LoginContext _dbContext;
        private readonly Configs _configs;
        private readonly IConnectionMultiplexer _redis;
        private readonly OidcConfig _oidcConfig;
        private readonly ClientStore _clientStore;
        
        public AuthController(IConfiguration configuration, LoginContext context, Configs configs, IConnectionMultiplexer redis, OidcConfig oidcConfig, ClientStore clientStore)
        {
            _configuration = configuration;
            _dbContext = context;
            _configs = configs;
            _redis = redis;
            _oidcConfig = oidcConfig;
            _clientStore = clientStore;
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
        
        private RsaSecurityKey GetPrivateKey()
        {
            var privateKeyPath = _configuration["PRIVATE_KEY_PATH"] ?? throw new InvalidOperationException("Private Key Path is missing from environment variables.");
            var privateKeyText = System.IO.File.ReadAllText(privateKeyPath);
            RSA rsaPrivate = RSA.Create();
            rsaPrivate.ImportFromPem(privateKeyText);
            var privateKey = new RsaSecurityKey(rsaPrivate);
            return privateKey;
        }
        
        private RsaSecurityKey GetPublicKey()
        {
            var publicKeyPath = _configuration["PUBLIC_KEY_PATH"] ?? throw new InvalidOperationException("Public Key Path is missing from environment variables.");
            var publicKeyText = System.IO.File.ReadAllText(publicKeyPath);
            RSA rsaPublic = RSA.Create();
            rsaPublic.ImportFromPem(publicKeyText);
            var publicKey = new RsaSecurityKey(rsaPublic);
            return publicKey;
        }
        
        [HttpPost("register")]
        public ActionResult Register([FromBody] RegistrationRequest data)
        {
            var user = _dbContext.Users.Where(e => e.Username == data.Username).FirstOrDefault();
            if (user != null)
                return Conflict();
            string passwordHash = BCrypt.Net.BCrypt.HashPassword(data.Password);
            var newUser = new UserData()
            {
                Username = data.Username,
                PasswordHash = passwordHash
            };
            _dbContext.Users.Add(newUser);
            _dbContext.SaveChanges();
            return Created("/auth/login", new { id = newUser.Id });
        }

        private string GenerateTokenString(ClaimsIdentity subject, DateTime expires)
        {
            var privateKey = GetPrivateKey();

            var tokenHandler = new JwtSecurityTokenHandler();
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = subject,
                Expires = expires,
                Issuer = _oidcConfig.Issuer,
                AdditionalHeaderClaims = new Dictionary<string, object>
                {
                    ["kid"] = RsaKeyHelper.GetKeyId(privateKey),
                    ["typ"] = "JWT"
                },
                SigningCredentials = new SigningCredentials(privateKey, SecurityAlgorithms.RsaSha256)
            };
            
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (!subject.Claims.Any(c => c.Type == "iat"))
                subject.AddClaim(new Claim("iat", now.ToString()));
            if (!subject.Claims.Any(c => c.Type == "auth_time"))
                subject.AddClaim(new Claim("auth_time", now.ToString()));
            
            var token = tokenHandler.CreateToken(tokenDescriptor);
            string tokenString = tokenHandler.WriteToken(token);
            return tokenString;
        }

        [HttpPost("login")]
        public ActionResult Login([FromBody] LoginRequest model)
        {
            var user = _dbContext.Users.Where(e => e.Username == model.Username).FirstOrDefault();

            if (user == null || !BCrypt.Net.BCrypt.Verify(model.Password, user?.PasswordHash))
            {
                return Unauthorized(new { Error = "Invalid credentials" });
            }
            var expireTime = DateTime.UtcNow.AddDays(_configs.RefreshTokenExpire.Days);
            expireTime = expireTime.AddMinutes(_configs.RefreshTokenExpire.Minutes);
            var tokenString = GenerateTokenString(
                new ClaimsIdentity(new Claim[]{ new Claim("sub", user!.Id.ToString())}), expireTime      
            );
            return Ok(new { token = tokenString });
        }

        [HttpPost("token/refresh")]
        public ActionResult RefreshToken([FromBody] RefreshTokenRequest model)
        {
            var validationParameters = GetValidationParameters();

            var tokenHandler = new JwtSecurityTokenHandler();

            try
            {
                var p = tokenHandler.ValidateToken(model.RefreshToken, validationParameters, out var validatedToken);
                var claims = p.Claims.Where(e => e.Type != "exp" && e.Type != "nbf" && e.Type != "iat").ToList();
                var expireTime = DateTime.UtcNow.AddDays(_configs.AccessTokenExpire.Days);
                expireTime = expireTime.AddMinutes(_configs.AccessTokenExpire.Minutes);
                
                if (!claims.Any(c => c.Type == "sub"))
                {
                    var userIdClaim = claims.FirstOrDefault(c => c.Type == "userId");
                    if (userIdClaim != null)
                        claims.Add(new Claim("sub", userIdClaim.Value));
                }
                if (!claims.Any(c => c.Type == "iss"))
                    claims.Add(new Claim("iss", _oidcConfig.Issuer));
                if (!claims.Any(c => c.Type == "auth_time"))
                    claims.Add(new Claim("auth_time", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()));
                
                var tokenString = GenerateTokenString(
                    new ClaimsIdentity(claims),
                    expireTime
                );
                return Ok(new {token = tokenString});
            }
            catch (SecurityTokenExpiredException)
            {
                return Unauthorized(new { error = "Token expired." });
            }
            catch (SecurityTokenInvalidSignatureException)
            {
                return Unauthorized(new { error = "Invalid signature." });
            }
            catch (Exception ex)
            {
                return Unauthorized(new { error = $"Error validating token: {ex.Message}" });
            }
        }

        [HttpPost("groups/{groupId}/service-token/generate")]
        public ActionResult GenerateServiceToken([FromRoute] int groupId, [FromBody] ServiceTokenRequest model)
        {
            if (model.Years == null || model.Years <= 0)
                model.Years = 1;
            var tokenString = GenerateTokenString(
                new ClaimsIdentity(new Claim[]{new Claim("sub", groupId.ToString()), new Claim("groupId", groupId.ToString())}),
                DateTime.UtcNow.AddYears((int)model.Years)
            );
            return Ok(new { token = tokenString });
        }

        [HttpPost("oauth/token")]
        [AllowAnonymous]
        public ActionResult OAuthToken([FromForm] OAuthTokenRequest request)
        {
            if (request.GrantType != "client_credentials")
                return BadRequest(new { error = "unsupported_grant_type" });

            var client = _clientStore.Validate(request.ClientId, request.ClientSecret);
            if (client == null)
                return Unauthorized(new { error = "invalid_client" });

            var groupId = client.AllowedGroupIds.FirstOrDefault();
            var claims = new List<Claim> {
                new("sub", groupId.ToString()),
                new("groupId", groupId.ToString()),
            };
            var expireTime = DateTime.UtcNow.AddYears(1);
            var tokenString = GenerateTokenString(
                new ClaimsIdentity(claims), expireTime
            );
            return Ok(new {
                access_token = tokenString,
                token_type = "Bearer",
                expires_in = 31536000,
                scope = "openid profile"
            });
        }

        [HttpPost("reset-password/request/{userId}")]
        public ActionResult ResetPasswordRequest([FromRoute] int userId)
        {
            var query = Guid.NewGuid().ToString("N");
            var db = _redis.GetDatabase();
            db.StringSet($"reset:{query}", userId.ToString(), TimeSpan.FromMinutes(15));
            return Ok(new { query, expires_in = 900 });
        }

        [HttpPost("reset-password/confirm")]
        public ActionResult ResetPasswordConfirm([FromQuery] string query, [FromBody] ResetPasswordData data)
        {
            var db = _redis.GetDatabase();
            var userIdStr = db.StringGet($"reset:{query}");
            
            if (!userIdStr.HasValue)
                return NotFound(new { error = "Query not found or expired" });
            
            db.KeyDelete($"reset:{query}");
            
            var userId = int.Parse(userIdStr!);
            var user = _dbContext.Users.Where(e => e.Id == userId).FirstOrDefault();
            if (user == null)
                return NotFound(new { error = "User not found" });
            
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(data.NewPassword);
            _dbContext.SaveChanges();
            
            return Ok(new { message = "Password reset successful" });
        }

        [HttpGet("check")]
        public ActionResult CheckToken()
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized(new { error = "Missing or invalid Authorization header" });

            var accessToken = authHeader.Substring("Bearer ".Length).Trim();
            var validationParameters = GetValidationParameters();

            var tokenHandler = new JwtSecurityTokenHandler();

            try
            {
                tokenHandler.ValidateToken(accessToken, validationParameters, out var validatedToken);
                return Ok();
            }
            catch (SecurityTokenExpiredException)
            {
                return Unauthorized(new { error = "Token expired." });
            }
            catch (SecurityTokenInvalidSignatureException)
            {
                return Unauthorized(new { error = "Invalid signature." });
            }
            catch (Exception ex)
            {
                return Unauthorized(new { error = $"Error validating token: {ex.Message}" });
            }
        }
    }

    public struct RegistrationRequest
    {
        public string Username { get; set; }
        public string Password { get; set; }
    }

    public struct LoginRequest
    {
        public string Username { get; set; }
        public string Password { get; set; }
    }

    public struct RefreshTokenRequest
    {
        public string RefreshToken { get; set; }
    }

    public struct ServiceTokenRequest
    {
        public int Access { get; set; }
        public int? Years { get; set; }
    }

    public struct ResetPasswordData
    {
        public string NewPassword { get; set; }
    }

    public struct OAuthTokenRequest
    {
        public string GrantType { get; set; }
        public string ClientId { get; set; }
        public string ClientSecret { get; set; }
    }
}