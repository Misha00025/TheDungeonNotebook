# uploads-service Rules

## Responsibility
File/image uploads. No database — files stored on filesystem.

## Project Structure (note: `Sources/` not `Source/`)
```
uploads-service/
├── Sources/
│   ├── Controllers/
│   │   └── UploadController.cs   # Single upload endpoint
│   ├── Model/
│   │   ├── UploadResponse.cs
│   │   ├── UserFileInfo.cs
│   │   └── AuthValidationResponse.cs
│   └── Services/
│       └── AuthService.cs         # IAuthService — calls auth-service
├── Program.cs
├── Dockerfile
├── docker-compose.yaml            # Standalone compose
└── appsettings.json
```

## Key Differences from Other C# Services
- Directory is `Sources/` with capital S and no `Db/` directory
- No EF Core, no MySQL, no MongoDB
- Uses `IHttpClientFactory` for HTTP calls to auth-service
- `AUTH_SERVICE_URL` env var is required for token validation

## Upload Configuration
- **Max file size: 10 MB** — set via `IISServerOptions.MaxRequestBodySize`
- Files stored in `wwwroot/` (created on startup if missing)
- MIME type and extension validation in `UploadController`

## Auth Integration
- `IAuthService` / `AuthService` — HTTP client to auth-service
- Validates Bearer token via auth-service before allowing uploads
- `AuthValidationResponse` model for the response

## Program.cs Specifics
```csharp
builder.Services.AddHttpClient<IAuthService, AuthService>(client =>
{
    client.BaseAddress = new Uri(authServiceUrl);
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.Configure<IISServerOptions>(options =>
{
    options.MaxRequestBodySize = 10 * 1024 * 1024; // 10MB
});
// ForwardedHeaders for running behind gateway
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
});
app.UseForwardedHeaders();
```

## Running
```bash
cd backend/uploads-service
docker compose up -d
```
