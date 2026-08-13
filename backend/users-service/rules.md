# users-service Rules

## Responsibility
User profile CRUD (MySQL) + per-user settings (MongoDB). No longer a strictly single-controller service.

## Project Structure
```
users-service/
├── Source/
│   ├── ConfigParser.cs
│   ├── DataToDict.cs             # ToDict() extension for UserData
│   ├── Controllers/
│   │   ├── BaseController.cs     # Same pattern as campaign-service
│   │   ├── UsersController.cs    # All user profile endpoints
│   │   └── UserSettingsController.cs
│   ├── Db/
│   │   ├── Contexts/
│   │   │   ├── BaseDbContext.cs
│   │   │   └── UserContext.cs     # Users DbSet (MySQL)
│   │   ├── Entities/
│   │   │   ├── UserEntities.cs    # UserData (Id, Nickname, VisibleName, Image)
│   │   │   └── UserSettingsMongoData.cs
│   │   └── EntityBuildersConfigurer.cs
│   ├── Providing/
│   │   ├── IUserSettingsStorage.cs
│   │   ├── UserSettingsProvider.cs
│   │   └── UserSettingsStorage.cs
│   └── Conversions/
│       └── SettingsJsonHelper.cs   # BsonValue <-> JSON
└── Program.cs
```

## UserData Entity
- `Id` (int)
- `Nickname` (string) — unique
- `VisibleName` (string)
- `Image` (string) — URL or empty string, field name maps to `imageLink` in API

## UsersController Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users` | Get all users. Query: `?ids=1,2,3` or `?nickname=...` |
| POST | `/users` | Create user (requires Id from auth-service) |
| GET | `/users/{userId}` | Get user by id |
| PATCH | `/users/{userId}` | Update visibleName, imageLink |
| DELETE | `/users/{userId}` | Delete user |

## User Settings (MongoDB)

- **Storage**: MongoDB, collection `settings`, one document per user (`user_id` + a map `settings` key → any JSON value). Database from env `MONGO_SETTINGS_DATABASE` (default `tdn-settings`).
- **Env vars**: `MONGO_CONNECTION_STRING`, `MONGO_SETTINGS_DATABASE`.
- **Endpoints** (through the gateway, `auth: required` + `access: self_only`):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/{user_id}/settings` | Get all settings. `?keys=a,b` — only that batch (missing keys omitted). Response `{"settings": {...}}`. |
| PUT | `/users/{user_id}/settings` | Body `{key: value, ...}`, upsert/merge. Response full `{"settings": {...}}`. |
| DELETE | `/users/{user_id}/settings` | **REQUIRED** `?keys=`; removes only listed keys; without keys → 400. Response remaining `{"settings": {...}}`. |

- **Access control**: owner only (`self_only`), enforced at the gateway.
- **Testing**: unit tests in `Tests/` for `UserSettingsProvider` (via mocked `IUserSettingsStorage`) and `SettingsJsonHelper`.

## Program.cs specifics
- MySQL DbContext: `UserContext`
- Scoped `IMongoDbContext` registered conditionally (when `MONGO_CONNECTION_STRING` is set)
- Scoped `IUserSettingsStorage` and `UserSettingsProvider`
- Single-DbContext statement now refers to MySQL (`UserContext`) only; MongoDB is used via `IMongoDbContext`

## Nickname Search
```
?nickname=foo → orders by: exact match → starts with → length → alphabetical
```

## Request Models
- `UserPostData`: Id?, Nickname, VisibleName?, ImageLink?
- `UserPatchData`: VisibleName?, ImageLink?