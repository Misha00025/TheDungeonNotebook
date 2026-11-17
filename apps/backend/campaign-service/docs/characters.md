# Characters, assignments, and sheets

All routes are scoped to `/api/campaigns/{campaignId:int}` and use the shared JSON `X-Subject` header described in [the API overview](README.md). A campaign admin is a global Admin, matching Group, or User campaign member whose membership is admin. User access to a character requires direct assignment. An assignment with `canWrite=false` permits reading the character and sheet but not writing. Group access remains scoped to its campaign. Other-campaign or non-member campaign access is hidden as `404`; a campaign member who is not assigned to a specific character receives `403`.

Character custom virtual fields, formula overrides, and the computed-sheet response are documented in [formulas, virtual fields, and computed sheets](formulas.md).

## Character metadata

```json
{"id":"4abe7cae-3a0a-42f3-82bf-75347f96daf2","campaignId":7,"templateId":"54ce37ea-40a5-481c-ae08-92a0eb8fe5c0","name":"Mira","importance":"Background","metadataRevision":1}
```

Importance is `Background`, `Secondary`, or `Key` (numeric enum values `0`, `1`, `2` are also accepted). New characters default to `Characters:DefaultImportance` (`background`); POST can explicitly provide another valid value. PUT requires importance.

## `GET /api/campaigns/{campaignId}/characters`

Returns `200` metadata array. Admins receive all characters; Users receive only directly assigned characters. A matching Group has campaign-admin access. A User who is a campaign member but has no direct assignments receives an empty array.

## `POST /api/campaigns/{campaignId}/characters`

Admin only. Required body fields: `requestId` (non-empty GUID), `name` (non-whitespace string), and `templateId` (GUID belonging to this campaign). `importance` is optional and must be a known enum value when supplied. The new character ID is `requestId`. A missing/cross-campaign template link is `400` (`invalid_template`). The service creates an empty Mongo sheet without copying any template values, then publishes SQL metadata. Success is `201 Created` with a metadata DTO.

An already published request ID returns `409` (`already_published`). A prepared Mongo document without SQL metadata returns `409` (`content_already_prepared`). An uncertain SQL publication result returns `503` (`publication_outcome_unknown`) with the resource ID. Prepared content is not exposed until SQL metadata exists; it is not automatically deleted or retried.

## `GET /api/campaigns/{campaignId}/characters/{characterId:guid}`

Returns `200` metadata to an admin or a directly assigned User. A campaign member without an assignment receives `403`; missing character or another campaign's character returns `404`.

Read the current subject's effective character permissions with [`GET /api/campaigns/{campaignId}/characters/{characterId}/permissions`](permissions.md). A read-only assignment can read its own permissions; this does not open the admin-only assignment list.

## `PUT /api/campaigns/{campaignId}/characters/{characterId:guid}`

Admin or an assigned User with `canWrite=true`. Body requires `name` (non-whitespace), `importance` (known enum), and `expectedRevision` (int64 >= 1). Success is `200` metadata with incremented `metadataRevision`; stale revision is `409`; missing character is `404`; missing write permission is `403`. This is SQL-only and does not change Mongo content revision.

## `GET /api/campaigns/{campaignId}/characters/{characterId:guid}/sheet`

Admin or directly assigned User, regardless of `canWrite`. Returns `200` effective sheet only; it never returns the stored raw `BaseValues` array. The response contains character `contentRevision`, current `templateContentRevision`, character `description`, and active template base-field definitions with `effectiveValue` and `isExplicit`.

For an active field, a stored value is explicit only when field ID, `typeRevision`, and value type match and the value remains compatible with current options. Otherwise the current template value is returned. If any key in an explicit single- or multi-choice record was removed from current options, the entire explicit record is incompatible and the complete template fallback is returned. GET never copies template defaults, writes Mongo content, cleans incompatible values, or exposes values for deleted fields.

## `PUT /api/campaigns/{campaignId}/characters/{characterId:guid}/description`

Admin or assigned User with `canWrite=true`. Body requires `description` (string; empty allowed) and `expectedRevision` (int64 >= 1). It replaces only the description, preserving all saved base values including hidden/incompatible entries, custom virtual fields, and formula overrides. Success is `200` with `{"contentRevision":2}`; stale content revision is `409`.

## `PUT /api/campaigns/{campaignId}/characters/{characterId:guid}/base-values/{fieldId:guid}`

Admin or assigned writer. Body requires native JSON `value` and `expectedRevision` (int64 >= 1). The field must be currently active or the request returns `404`; incompatible values/options return `400`. The service reads the current template and sheet, replaces only that field's explicit record (using server-owned current type and `typeRevision`), preserves every other stored record, including custom virtual fields and formula overrides, and atomically replaces the Mongo document at the expected revision. Success returns `200` effective sheet with the new revision; stale content revision is `409`.

Values are native JSON: `Integer` is int64 and accepts integral forms such as `1.0`; `Number` is finite double without rounding; `String` includes the empty string; `Boolean` includes false; `SingleChoice` is one existing option key; `MultiChoice` is a unique array of existing keys and may be empty. JSON null is not a value for these field types.

## `DELETE /api/campaigns/{campaignId}/characters/{characterId:guid}/base-values/{fieldId:guid}?expectedRevision={revision}`

Admin or assigned writer. `expectedRevision` is required int64 >= 1. Only a currently active field can be reset; otherwise return `404`. The explicit entry is removed, leaving every other record untouched, and the template fallback becomes effective. Success is `200` with the effective sheet. If the field has no explicit entry, the operation is a successful no-op and does not increment content revision. A stale revision returns `409`.

## `GET /api/campaigns/{campaignId}/characters/{characterId:guid}/assignments`

Admin only. Returns `200` with assignment DTO array. Missing character is `404`; other campaign access is `404`; non-admin campaign member is `403`.

## `PUT /api/campaigns/{campaignId}/characters/{characterId:guid}/assignments/{userId:int}`

Admin only. The path `userId` must identify a current member of this campaign; absent membership returns `404`. Body requires `canWrite` (boolean, including false) and `expectedRevision` (int64 >= 0). Zero is insert-only: success `201 Created` with assignment DTO; an existing assignment is `409`. A positive revision updates via SQL CAS: success `200` with incremented assignment `metadataRevision`; missing assignment is `404`; stale revision is `409`. There is no remote account lookup or one-owner rule.

## `DELETE /api/campaigns/{campaignId}/characters/{characterId:guid}/assignments/{userId:int}?expectedRevision={revision}`

Admin only. `expectedRevision` is required int64 >= 1. Success is `204`; missing assignment/character is `404`; stale revision is `409`; non-admin is `403`.

Character assignments use restrictive foreign keys to campaign membership. Explicitly delete a member's character assignments before deleting that campaign membership; otherwise membership deletion returns `409` (`member_has_assignments`). The API does not cascade assignments. There is no character deletion endpoint.

## Publication, revisions, and failures

Template and character IDs are their creation `requestId`. Mongo content is inserted first with content revision 1 and never upserted. SQL metadata is published only after content preparation. Existing published IDs return `409` (`already_published`); an orphan prepared document returns `409` (`content_already_prepared`). An uncertain SQL commit returns safe `503` (`publication_outcome_unknown`) with `resourceId`; the service does not delete prepared content or retry. Mongo write errors with unknown outcomes return safe `503` (`content_write_outcome_unknown`); Mongo read errors return `503` (`dependency_unavailable`). No distributed SQL/Mongo transaction or automatic orphan cleanup is claimed. DB/Mongo details and credentials are not exposed.
