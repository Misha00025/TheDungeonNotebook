# auth-service Rules

## Responsibility
Registration, login, JWT (RSA-256), OAuth 2.0 token endpoint (password, refresh_token), token refresh, token validation.

## Project Structure (differences from generic)
```
auth-service/
├── Source/
│   ├── Config.cs                 # Configs class (token expiry settings)
│   ├── ConfigParser.cs           # Parse appsettings → Configs
│   ├── IssuerConfig.cs           # OIDC_ISSUER_URL env var
│   ├── Controllers/
│   │   ├── AuthController.cs     # All auth endpoints (register, check, reset-password)
│   │   └── TokenController.cs    # Token endpoint, JWKS
│   └── Db/
│       ├── Contexts/
│       │   ├── BaseDbContext.cs
│       │   └── LoginContext.cs    # Users DbSet
│       ├── Entities/
│       │   └── LoginEntities.cs   # UserData (Id, Username, PasswordHash)
│       └── EntityBuildersConfigurer.cs
└── Program.cs
```

## RSA JWT
- `PRIVATE_KEY_PATH` / `PUBLIC_KEY_PATH` env vars → paths to PEM files
- Algorithm: `SecurityAlgorithms.RsaSha256`
- Keys mounted from `backend/certs/` at `/certs` in container
- `RsaSecurityKey` with `RSA.Create().ImportFromPem()`

## Two-Port Architecture

Auth-service слушает на двух портах:

| Порт | Назначение | Доступ |
|------|-----------|--------|
| `8080` | Публичный (через nginx) | register, check, token, reset-password/confirm, .well-known/jwks.json |
| `8081` | Внутренний (docker-network) | Все endpoint'ы |

Защита реализована в `InternalPortProtectionMiddleware` — на порту 8080 отклоняются (403) запросы к internal-only endpoint'ам.

В `Program.cs` два порта задаются через `app.Run("http://0.0.0.0:8080;http://0.0.0.0:8081")`.

## AuthController Endpoints

| Method | Path | Public (:8080) | Internal (:8081) | Purpose |
|--------|------|----------------|------------------|---------|
| POST | `/auth/register` | ✅ | ✅ | Register with Username + Password |
| POST | `/token` | ✅ | ✅ | OAuth 2.0 token endpoint (password, refresh_token) |
| POST | `/auth/groups/{groupId}/service-token/generate` | ❌ 403 | ✅ | Generate service token for group (internal) |
| GET | `/auth/check` | ✅ | ✅ | Validate Bearer token |
| POST | `/auth/reset-password/confirm` | ✅ | ✅ | Confirm password reset |
| POST | `/auth/reset-password/request/{userId}` | ❌ 403 | ✅ | Request password reset (internal) |

## Internal Port Protection

Файл: `Source/InternalPortProtectionMiddleware.cs`

Проверяет `HttpContext.Connection.LocalPort`. Если порт ≠ 8081 и путь начинается с internal-only префикса — возвращает 403.

```csharp
// Internal-only prefixes
"/auth/groups/"
"/auth/reset-password/request/"
```

## Program.cs specifics
- `Configs` registered as **singleton** (token expiry from config)
- Only `LoginContext` DbContext (no other domains)
- No providers — logic is in controller directly

## Request Models (nested structs)
- `RegistrationRequest`: Username, Password
- `ResetPasswordData`: NewPassword

## Token Claims
- User token: `sub` (userId), `userId`, `aud` ("api-gateway"), `iss`, `iat`
- Service token: `sub` (client_id), `groupId`

## BCrypt
- Package: BCrypt.Net
- `BCrypt.Net.BCrypt.HashPassword(password)`
- `BCrypt.Net.BCrypt.Verify(password, hash)`


