# auth-service Rules

## Responsibility
Registration, login, JWT (RSA-256), token refresh, service tokens, token validation.

## Project Structure (differences from generic)
```
auth-service/
├── Source/
│   ├── Config.cs                 # Configs class (token expiry settings)
│   ├── ConfigParser.cs           # Parse appsettings → Configs
│   ├── Controllers/
│   │   └── AuthController.cs     # All auth endpoints
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

## AuthController Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Register with Username + Password |
| POST | `/auth/login` | Login → returns JWT token |
| POST | `/auth/token/refresh` | Refresh expired token |
| POST | `/auth/groups/{groupId}/service-token/generate` | Generate service token for group |
| GET | `/auth/check` | Validate Bearer token |

## Program.cs specifics
- `Configs` registered as **singleton** (token expiry from config)
- Only `LoginContext` DbContext (no other domains)
- No providers — logic is in controller directly

## Request Models (nested structs)
- `RegistrationRequest`: Username, Password
- `LoginRequest`: Username, Password
- `RefreshTokenRequest`: RefreshToken
- `ServiceTokenRequest`: Access, Years?

## Token Claims
- User token: `new Claim("userId", user.Id.ToString())`
- Service token: `new Claim("groupId", groupId.ToString())`

## BCrypt
- Package: BCrypt.Net
- `BCrypt.Net.BCrypt.HashPassword(password)`
- `BCrypt.Net.BCrypt.Verify(password, hash)`
