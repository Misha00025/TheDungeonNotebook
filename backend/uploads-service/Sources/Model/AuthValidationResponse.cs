namespace Tdn.UploadService.Models;

public class AuthValidationResponse
{
    public bool IsValid { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string? Error { get; set; }
}