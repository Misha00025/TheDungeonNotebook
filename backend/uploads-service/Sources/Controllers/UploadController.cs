using Tdn.UploadService.Models;
using Tdn.UploadService.Services;
using Microsoft.AspNetCore.Mvc;

namespace Tdn.UploadService.Controllers;

[ApiController]
[Route("uploads")]
public class UploadController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<UploadController> _logger;
    private static readonly string[] _allowedExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp" };
    private const long _maxFileSize = 10 * 1024 * 1024; // 10MB

    public UploadController(
        IAuthService authService,
        IWebHostEnvironment environment,
        ILogger<UploadController> logger)
    {
        _authService = authService;
        _environment = environment;
        _logger = logger;
    }

    [HttpPost]
    [RequestSizeLimit(_maxFileSize)]
    public async Task<ActionResult<UploadResponse>> UploadImage(IFormFile file)
    {
        // Проверка авторизации
        var authHeader = Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(authHeader))
            return Unauthorized("Authorization header is missing or invalid");

        var token = authHeader;
        var authResult = await _authService.ValidateTokenAsync(token);
        
        if (!authResult.IsValid)
        {
            _logger.LogWarning("Invalid token attempt: {Error}", authResult.Error);
            return Unauthorized(authResult.Error ?? "Invalid token");
        }

        // Валидация файла
        var validationResult = ValidateFile(file);
        if (!validationResult.IsValid)
        {
            return BadRequest(validationResult.ErrorMessage);
        }

        // Сохранение файла
        try
        {
            var uploadResult = await SaveFileAsync(file, authResult.UserId);
            _logger.LogInformation("User {UserId} uploaded image: {FileName}", authResult.UserId, uploadResult.FileName);
            
            return Ok(uploadResult);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving file for user {UserId}", authResult.UserId);
            return StatusCode(500, "Error saving file");
        }
    }

    private (bool IsValid, string? ErrorMessage) ValidateFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return (false, "File is required");

        if (file.Length > _maxFileSize)
            return (false, $"File size exceeds {_maxFileSize / 1024 / 1024}MB limit");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(extension) || !_allowedExtensions.Contains(extension))
            return (false, $"Allowed file types: {string.Join(", ", _allowedExtensions)}");

        // Проверка MIME типа
        var allowedMimeTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/bmp", "image/webp" };
        if (!allowedMimeTypes.Contains(file.ContentType.ToLowerInvariant()))
            return (false, "Invalid file type");

        return (true, null);
    }

    private async Task<UploadResponse> SaveFileAsync(IFormFile file, string userId)
    {
        var uploadsFolder = Path.Combine(_environment.WebRootPath, "uploads", userId);
        
        if (!Directory.Exists(uploadsFolder))
            Directory.CreateDirectory(uploadsFolder);

        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var filePath = Path.Combine(uploadsFolder, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var fileUrl = $"{baseUrl}/uploads/{userId}/{fileName}";

        return new UploadResponse
        {
            Url = fileUrl,
            FileName = fileName,
            Size = file.Length
        };
    }
}