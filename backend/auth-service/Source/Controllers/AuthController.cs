using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace Tdn.Api.Controllers
{
    [Route("auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly LoginContext _dbContext;
        public AuthController(IConfiguration configuration, LoginContext context)
        {
            _configuration = configuration;
            _dbContext = context;
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
                ClockSkew = TimeSpan.FromHours(4)
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
            if (data.UserId == null)
                return BadRequest();
            var user = _dbContext.Users.Where(e => e.Username == data.Username || e.Id == data.UserId).FirstOrDefault();
            if (user != null)
                return Conflict();
            string passwordHash = BCrypt.Net.BCrypt.HashPassword(data.Password);
            var newUser = new UserData()
            {
                Id = (int)data.UserId,
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
                SigningCredentials = new SigningCredentials(privateKey, SecurityAlgorithms.RsaSha256)
            };
            
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
            var tokenString = GenerateTokenString(
                new ClaimsIdentity(new Claim[]{ new Claim("userId", user!.Id.ToString()),}), 
                DateTime.UtcNow.AddDays(3)
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
                var claims = p.Claims.Where(e => e.Type != "exp" && e.Type != "nbf" && e.Type != "iat");
                var tokenString = GenerateTokenString(
                    new ClaimsIdentity(claims),
                    DateTime.UtcNow.AddMinutes(10)
                );
                return Ok(new {accessToken = tokenString});
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
                new ClaimsIdentity(new Claim[]{new Claim("groupId", groupId.ToString())}),
                DateTime.UtcNow.AddYears((int)model.Years)
            );
            return Ok(new { token = tokenString });
        }

        [HttpGet("check")]
        public ActionResult CheckToken([FromQuery]string accessToken)
        {
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
        public int? UserId { get; set; }
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
}