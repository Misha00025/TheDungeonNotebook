using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using Tdn.UploadService.Models;

namespace Tdn.UploadService.Services;

public interface IAuthService
{
    Task<AuthValidationResponse> ValidateTokenAsync(string token);
}

public class AuthService : IAuthService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AuthService> _logger;

    public AuthService(HttpClient httpClient, ILogger<AuthService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public string? GetUserIdFromToken(string token)
    {
        try
        {
            // Если токен в формате JWT
            if (token.Contains('.') && token.Split('.').Length == 3)
            {
                var handler = new JwtSecurityTokenHandler();

                if (handler.CanReadToken(token))
                {
                    var jwtToken = handler.ReadJwtToken(token);

                    // Попробуем найти userId в различных возможных claims
                    var userId = jwtToken.Claims.FirstOrDefault(c =>
                        c.Type == "userId" ||
                        c.Type == "sub" ||
                        c.Type == "nameid" ||
                        c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                    if (!string.IsNullOrEmpty(userId))
                    {
                        return userId;
                    }

                    _logger.LogWarning("UserId not found in JWT token claims");
                }
            }

            // Если не JWT или userId не найден, попробуем декодировать как base64 JSON
            try
            {
                // Пытаемся разобрать токен как base64 JSON объект
                var base64Parts = token.Split('.');
                if (base64Parts.Length > 0)
                {
                    var payload = base64Parts.Length > 1 ? base64Parts[1] : base64Parts[0];

                    // Добавляем padding если необходимо
                    payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');

                    var payloadBytes = Convert.FromBase64String(payload);
                    var payloadJson = System.Text.Encoding.UTF8.GetString(payloadBytes);

                    using var document = JsonDocument.Parse(payloadJson);

                    // Ищем userId в JSON
                    if (document.RootElement.TryGetProperty("userId", out var userIdElement) &&
                        userIdElement.ValueKind == JsonValueKind.String)
                    {
                        return userIdElement.GetString();
                    }

                    if (document.RootElement.TryGetProperty("sub", out var subElement) &&
                        subElement.ValueKind == JsonValueKind.String)
                    {
                        return subElement.GetString();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to decode token as base64 JSON");
            }

            _logger.LogError("Could not extract userId from token");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting userId from token");
            return null;
        }
    }

    public async Task<AuthValidationResponse> ValidateTokenAsync(string token)
    {
        try
        {
            var response = await _httpClient.GetAsync($"/auth/check?accessToken={Uri.EscapeDataString(token)}");
            
            if (response.IsSuccessStatusCode)
            {
                var id = GetUserIdFromToken(token);
                var validationResult = new AuthValidationResponse { IsValid = id != null, UserId = id ?? "" };                
                return validationResult ?? new AuthValidationResponse { IsValid = false, Error = "Invalid response format" };
            }

            return new AuthValidationResponse 
            { 
                IsValid = false, 
                Error = $"Auth service returned {response.StatusCode}" 
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating token with auth service");
            return new AuthValidationResponse 
            { 
                IsValid = false, 
                Error = "Unable to connect to auth service" 
            };
        }
    }
}