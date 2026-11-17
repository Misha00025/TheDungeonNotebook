# Campaigns and members API

All routes use JSON. Send the ordinary JSON `X-Subject` request header; it is not a JWT or base64 value. Property names are case-insensitive. `Type` accepts `User`, `Group`, `Admin` (case-insensitive) or numeric enum values `0`, `1`, `2`; an unknown numeric value grants no rights. `Id` is an int32. A missing, empty, malformed, JSON-null, or incomplete header is treated as no subject. Protected operations then return `403`.

```http
X-Subject: {"Type":"User","Id":42}
```

```http
X-Subject: {"type":2,"id":1}
```

```http
X-Subject: {"Type":"Group","Id":12}
```

`Group.Id` is the numeric campaign ID, not a Party ID. `User` access comes from campaign membership. `Admin` is global. A resource outside a User's membership or a Group's campaign scope is hidden as `404`; an authenticated User who is a member but lacks campaign-admin rights receives `403` for admin-only operations.

Successful campaign responses have this shape:

```json
{"id":12,"name":"The Delvers","metadataRevision":1}
```

Member responses have this shape:

```json
{"campaignId":12,"userId":42,"isAdmin":true,"metadataRevision":1}
```

## `POST /api/campaigns`

Create a campaign. JSON body fields:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string | yes | Must not be null, empty, or whitespace. No application length limit is imposed. |
| `requestId` | GUID | yes | Must not be `Guid.Empty`; unique creation request identity. |
| `administratorUserId` | int32 | Admin subject only | Initial member who is campaign admin. Required for Admin. User may omit it or set it to their own subject ID; another value is `403`. |

A User creates a campaign and is automatically its first admin. A Group or unknown subject type receives `403`. The campaign and initial membership are saved together. Success is `201 Created`, with a campaign DTO and `Location: /api/campaigns/{id}`.

Reusing a published `requestId` returns `409` with `code: creation_already_published` and `resourceId` when the caller is its original creator or a global Admin. A different creator receives `403` without resource details. A failed or unknown database commit is not automatically retried; use the creation-status endpoint to check publication.

## `GET /api/campaigns`

Return `200` with campaign DTO array. A User receives only campaigns for which they currently have membership. A global Admin receives all campaigns. Group and unknown subject types receive `403`; there is no unscoped Group listing.

## `GET /api/campaigns/creation/{requestId}`

`requestId` is a GUID path parameter. Return `200` with `{"requestId":"...","resourceId":12}` only to the original User creator who still has membership or to a global Admin. Missing request returns `404`; a User without current access gets `404`; Group and unknown subject types get `403`. This endpoint checks publication after an uncertain create result; it is not a workflow or retry mechanism.

## `GET /api/campaigns/{campaignId}`

`campaignId` is an int32 path parameter. Return `200` with a campaign DTO for a global Admin, a Group whose `Id` equals the campaign ID, or a User with membership. Missing or out-of-scope campaign returns `404`.

Read the current subject's effective campaign permissions with [`GET /api/campaigns/{campaignId}/permissions`](permissions.md). This is available to regular members and does not open the member list.

## `PUT /api/campaigns/{campaignId}`

Rename a campaign. Only a global Admin, matching Group, or User campaign admin may call this operation. Body:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string | yes | Must not be whitespace. |
| `expectedRevision` | int64 | yes | Must be at least 1; compared atomically with current `metadataRevision`. |

Success is `200` with the updated campaign DTO and incremented `metadataRevision`. Missing/out-of-scope campaign is `404`; non-admin member is `403`; stale revision is `409` (`revision_conflict`).

## `GET /api/campaigns/{campaignId}/members`

Return `200` with member DTO array. Only a global Admin, matching Group, or User campaign admin may list members. A regular member receives `403`; missing or out-of-scope campaign is `404`.

## `PUT /api/campaigns/{campaignId}/members/{userId}`

Insert or update membership. `campaignId` and `userId` are int32 path parameters; `userId` is not restricted to positive numbers. Only a global Admin, matching Group, or User campaign admin may call this operation. Body:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `isAdmin` | boolean | yes | Whether the member has campaign-admin rights. |
| `expectedRevision` | int64 | yes | `0` means insert-only; positive means update only at that revision. |

With `expectedRevision: 0`, success is `201 Created`, member DTO, and a member `Location`. Existing membership is `409` (`member_already_exists`). With a positive revision, success is `200` with member DTO and incremented `metadataRevision`; missing membership is `404`, stale revision is `409` (`revision_conflict`). Missing/out-of-scope campaign is `404`; a non-admin member receives `403`. No remote account lookup is performed.

## `DELETE /api/campaigns/{campaignId}/members/{userId}?expectedRevision={revision}`

`campaignId` and `userId` are int32 path parameters. `expectedRevision` is a required int64 query parameter of at least 1. Only a global Admin, matching Group, or User campaign admin may call this operation. Success is `204 No Content`; missing/out-of-scope campaign or membership is `404`; non-admin member is `403`; stale revision is `409` (`revision_conflict`). If restrictive references remain, it returns `409` (`member_has_assignments`). No last-admin or self-removal prohibition is imposed.

Explicitly delete the member's character assignments first using the character assignment endpoint; membership deletion does not cascade them.

There is no campaign deletion endpoint. Historical consequences have not been specified.

## Errors

Errors use ASP.NET Core Problem Details JSON with a machine-readable `code` extension. Body/query binding and validation failures return `400` with `code: invalid_request`; semantic request errors return `400` with codes such as `invalid_name`, `invalid_request_id`, `invalid_revision`, or `administrator_required`. Domain errors include `forbidden` (`403`), `not_found` (`404`), and conflict codes (`409`), including `member_has_assignments`. Database unavailability returns a safe `503` (`dependency_unavailable`); uncertain SQL writes return `503` (`write_outcome_unknown`); uncertain Mongo writes return `503` (`content_write_outcome_unknown`). Unexpected errors return a safe `500` (`internal_error`). Database details and connection strings are not returned.
