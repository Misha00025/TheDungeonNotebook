using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using StackExchange.Redis;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using System.Security.Cryptography;
using Tdn.Configuration;
using Tdn.Security;

namespace Tdn.Api.Controllers
{
    [Route("")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly LoginContext _dbContext;
        private readonly Configs _configs;
        private readonly IConnectionMultiplexer _redis;
        private readonly IssuerConfig _issuerConfig;
        
        public AuthController(IConfiguration configuration, LoginContext context, Configs configs, IConnectionMultiplexer redis, IssuerConfig issuerConfig)
        {
            _configuration = configuration;
            _dbContext = context;
            _configs = configs;
            _redis = redis;
            _issuerConfig = issuerConfig;
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

        internal string GenerateTokenString(ClaimsIdentity subject, DateTime expires, string audience = "api-gateway", List<Claim>? claimsOverrides = null)
        {
            var privateKey = GetPrivateKey();

            if (claimsOverrides != null)
            {
                subject = new ClaimsIdentity(claimsOverrides);
            }

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


        [HttpPost("groups/{groupId}/service-token/generate")]
        public ActionResult GenerateServiceToken([FromRoute] int groupId, [FromBody] ServiceTokenRequest request)
        {
            var expireTime = DateTime.UtcNow.AddYears(request.Years);
            var claims = new List<Claim>
            {
                new Claim("sub", groupId.ToString()),
                new Claim("groupId", groupId.ToString()),
                new Claim("access_level", request.Access.ToString())
            };
            var tokenString = GenerateTokenString(new ClaimsIdentity(claims), expireTime);
            return Ok(new { token = tokenString });
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

    public struct ResetPasswordData
    {
        public string NewPassword { get; set; }
    }

    public struct ServiceTokenRequest
    {
        public int Access { get; set; }
        public int Years { get; set; }
    }
}
