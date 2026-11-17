# Resource permissions

These endpoints return a read-only snapshot of the effective permissions of the current `X-Subject`. They do not list grants, identify other users, or issue a token that grants access. Permission checks still run on every resource operation; later requests can observe changed or revoked access. No atomic snapshot across separate requests is promised.

Both routes use the ordinary JSON `X-Subject` header described in [the API overview](README.md). They have no request body, query parameters, or user selector. `X-Subject` must not be supplied by an untrusted client through the public Gateway; the Gateway forwards the verified subject from its authenticated context. Responses use `Cache-Control: no-store` and `200` JSON:

```json
{"canRead":true,"canWrite":false,"canManageAccess":false}
```

All three properties are booleans and describe current effective access, not editable grants. A denied or hidden resource returns the applicable error, never an all-false permission object.

| Subject and resource | `canRead` | `canWrite` | `canManageAccess` |
| --- | --- | --- | --- |
| Campaign: regular User member | `true` | `false` | `false` |
| Campaign: campaign-admin User member | `true` | `true` | `true` |
| Campaign: matching Group | `true` | `true` | `true` |
| Campaign: global Admin | `true` | `true` | `true` |
| Character: assigned User with `canWrite=false` | `true` | `false` | `false` |
| Character: assigned User with `canWrite=true` | `true` | `true` | `false` |
| Character: campaign-admin User, matching Group, or global Admin | `true` | `true` | `true` |

For campaigns, `canWrite` means permission to edit campaign metadata; `canManageAccess` means permission to manage `CampaignMember` grants. For characters, `canWrite` means permission to update character metadata and sheet content; `canManageAccess` means permission to manage `CharacterAssignment` grants. These flags do not mean permission to delete a resource; TDN-10 has no resource DELETE endpoints. They do not introduce roles, grants, or conditions beyond the existing campaign membership and character assignment checks.

## `GET /api/campaigns/{campaignId:int}/permissions`

Returns the current subject's campaign permissions. A regular campaign member may read their own permissions even though listing members remains admin-only. A missing, empty, malformed, JSON-null, incomplete, or unknown subject returns `403`. A non-member User, Group outside its campaign scope, or missing campaign returns `404`, including for global Admin when the campaign is missing. SQL/network unavailability returns a safe `503 ProblemDetails` response.

## `GET /api/campaigns/{campaignId:int}/characters/{characterId:guid}/permissions`

Returns the current subject's effective permissions for that character. A character assignment with `canWrite=false` still permits reading permissions and the character/sheet. A campaign member without an assignment receives `403`; missing or cross-campaign character and hidden campaign receive `404`. A malformed constrained path returns the framework's standard `404`. SQL/network unavailability returns a safe `503 ProblemDetails` response.

Both routes require a valid current subject; missing or invalid subjects receive `403`. Existing member and assignment grant-list endpoints remain admin-only. Each request reads current SQL metadata and assignments, without MongoDB reads, calculations, or writes. Object GETs and lists do not embed permissions. A future BFF owns any composition; for now clients make separate reads through the existing BFF proxy. A permission response is a snapshot, not a grant token: write operations re-check permissions, and revocation or edits may change the next request. Cross-request atomicity is not promised.
