# Templates and base-field definitions

These routes are scoped to `/api/campaigns/{campaignId:int}` and use the shared JSON `X-Subject` header documented in [the API overview](README.md). A global Admin and a Group whose subject ID matches the campaign are campaign admins. A User must be a current campaign member; only a campaign admin can write definitions. Members may read template definitions when `Access:MembersCanReadDefinitions` is `true` (default); this setting does not grant access to unassigned characters.

Template virtual fields and formula definitions are documented in [formulas, virtual fields, and computed sheets](formulas.md).

## Metadata shape

```json
{"id":"54ce37ea-40a5-481c-ae08-92a0eb8fe5c0","key":"54ce37ea40a5481cae0892a0eb8fe5c0","campaignId":7,"name":"Adventurer","metadataRevision":1}
```

`key` is derived from `id` in GUID `N` format (32 hexadecimal digits without hyphens); it is not stored as a second mutable field. `metadataRevision` is an int64 and starts at 1.

## Base-field input and stored definitions

`BaseFieldInput` has fields:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | GUID or null/omitted | no | Omit/null to create a new field. An ID must identify a currently active field in this template to update it. |
| `key` | string | yes | Stable field key, unique among active fields. Existing keys cannot be changed. No application length limit is imposed. |
| `title` | string | yes | Display title. |
| `description` | string | yes | Field description. |
| `valueType` | enum string | yes | `Integer`, `Number`, `String`, `Boolean`, `SingleChoice`, or `MultiChoice`. |
| `value` | JSON value | yes | Required template default, compatible with its type and options. |
| `options` | array of `{optionKey,title}` | yes | Choice options; use an empty array for non-choice fields. Keys must be unique. |

Enum names are accepted case-insensitively; the standard JSON enum converter also accepts their numeric values: `Integer=0`, `Number=1`, `String=2`, `Boolean=3`, `SingleChoice=4`, `MultiChoice=5`. Unknown values return `400`.

Values are native JSON values. `Integer` accepts int64 values, including integral JSON spellings such as `1.0`; `Number` is finite IEEE-754 double and is not rounded. `String` accepts strings, including `""`; `Boolean` accepts both `true` and `false`. `SingleChoice` is one existing option key. `MultiChoice` is an array of unique existing option keys; an empty array is valid. A saved template value must use the current options. Unknown options and incompatible values return `400`.

An omitted `id` generates a new GUID with `typeRevision: 1`. A supplied ID must be active in this template or the request returns `400` (`unknown_field`). Existing keys are immutable. Changing `valueType` increments `typeRevision`; other edits do not. Removing a field from the submitted active list does not delete stored character values. Re-adding the same key creates a new field identity.

## `GET /api/campaigns/{campaignId}/templates`

Returns `200` and an array of template metadata. Admins see all campaign templates. A User member can read the list when `Access:MembersCanReadDefinitions=true`; otherwise they receive `403`. Non-member/out-of-scope campaign is `404`.

## `POST /api/campaigns/{campaignId}/templates`

Admin only. Required JSON body:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `requestId` | non-empty GUID | yes | Also becomes the immutable template `id`. |
| `name` | non-whitespace string | yes | Template name; no application length limit. |
| `description` | string | yes | May be empty. |
| `baseFields` | array of `BaseFieldInput` | yes | Initial active definitions; may be empty. |

Returns `201 Created`, a template metadata DTO with `contentRevision: 1`, and `Location: /api/campaigns/{campaignId}/templates/{id}`. Content is prepared in MongoDB before SQL metadata is published. A previously published ID returns `409` (`already_published`); a pre-existing prepared document without SQL metadata returns `409` (`content_already_prepared`). An uncertain SQL publication result returns safe `503` (`publication_outcome_unknown`) with `resourceId`; an unknown Mongo write result returns safe `503` (`content_write_outcome_unknown`). The service does not delete prepared documents or retry publication automatically; unpublished prepared documents are not readable through API routes.

## `GET /api/campaigns/{campaignId}/templates/{templateId:guid}`

Returns `200` metadata. Read permissions are the same as the template list. Missing/out-of-campaign template is `404`.

## `PUT /api/campaigns/{campaignId}/templates/{templateId:guid}`

Admin only. Body requires `name` (non-whitespace string) and `expectedRevision` (int64 >= 1). This changes SQL metadata only; content revision is untouched. Success returns `200` metadata with incremented `metadataRevision`. Missing resource is `404`; stale revision is `409` (`revision_conflict`); invalid body is `400`.

## `GET /api/campaigns/{campaignId}/templates/{templateId:guid}/content`

Returns `200` with the complete current template content envelope:

```json
{"campaignId":7,"resourceId":"54ce37ea-40a5-481c-ae08-92a0eb8fe5c0","contentRevision":1,"data":{"description":"","baseFields":[],"virtualFields":[]}}
```

The envelope `contentRevision` is independent of SQL `metadataRevision`. Read permissions match the metadata GET. Missing metadata is `404`; published metadata with unavailable content returns safe `503` (`content_unavailable`).

## `PUT /api/campaigns/{campaignId}/templates/{templateId:guid}/content`

Admin only. Body requires `expectedRevision` (int64 >= 1), `description` (string; empty allowed), and the complete new active `baseFields` array. The update replaces the active base definitions as one Mongo document revision and preserves `virtualFields`. Success returns `200` with the updated envelope and `contentRevision + 1`. Stale revision is `409` (`content_revision_conflict`); unknown field IDs, duplicate active keys/IDs, immutable-key changes, and incompatible values/options return `400`; missing template is `404`; unknown Mongo write outcomes return safe `503` (`content_write_outcome_unknown`), while Mongo read errors return `503` (`dependency_unavailable`).

There is no template deletion endpoint because reference/removal behavior has not been specified.
