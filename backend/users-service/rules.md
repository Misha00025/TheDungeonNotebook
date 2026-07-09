# users-service Rules

## Responsibility
User profile CRUD. Simple service — single controller, single DbContext.

## Project Structure
```
users-service/
├── Source/
│   ├── ConfigParser.cs
│   ├── DataToDict.cs             # ToDict() extension for UserData
│   ├── Controllers/
│   │   ├── BaseController.cs     # Same pattern as campaign-service
│   │   └── UsersController.cs    # All user endpoints
│   └── Db/
│       ├── Contexts/
│       │   ├── BaseDbContext.cs
│       │   └── UserContext.cs     # Users DbSet
│       ├── Entities/
│       │   └── UserEntities.cs    # UserData (Id, Nickname, VisibleName, Image)
│       └── EntityBuildersConfigurer.cs
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

## Program.cs specifics
- Single DbContext: `UserContext`
- No providers
- Simple CRUD with no access control (admin-panel will handle that)

## Nickname Search
```
?nickname=foo → orders by: exact match → starts with → length → alphabetical
```

## Request Models
- `UserPostData`: Id?, Nickname, VisibleName?, ImageLink?
- `UserPatchData`: VisibleName?, ImageLink?
