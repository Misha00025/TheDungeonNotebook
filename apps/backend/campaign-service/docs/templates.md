# Campaign template and base-field definitions

Each campaign has exactly one `TemplateMetadata` row. `CampaignId` is both its primary key and a restrictive foreign key to `Campaigns.Id`; the campaign navigation is one-to-one. Campaign creation stores the campaign, its initial template metadata, and its first administrator in the same SQL save. The initial template name matches the campaign name and `metadataRevision` starts at `1`. There is no separate template create, list, delete, resource-ID, or key endpoint.

These routes use `/api/campaigns/{campaignId:int}` and the JSON `X-Subject` contract in [the API overview](README.md). A global Admin or matching Group can administer definitions. A User must be a campaign member and an admin member to write; members may read definitions when `Access:MembersCanReadDefinitions` is enabled (default). The setting does not grant access to unassigned character sheets. Missing or out-of-scope campaigns return `404`; insufficient rights return `403`.

Template virtual fields and formulas are documented in [formulas, virtual fields, and computed sheets](formulas.md).

## Metadata

```json
{"campaignId":7,"name":"Campaign","metadataRevision":1}
```

`metadataRevision` is int64 and starts at `1`. Renaming template metadata changes SQL only; it does not change the content revision.

## Base-field input and stored definitions

`BaseFieldInput` has fields:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | GUID or null/omitted | no | Omit/null to create a field. A supplied ID must identify an active field in this campaign's template. |
| `key` | string | yes | Stable key, unique among active base fields. Existing keys cannot be changed. |
| `title` | string | yes | Display title. |
| `description` | string | yes | Field description. |
| `valueType` | enum string | yes | `Integer`, `Number`, `String`, `Boolean`, `SingleChoice`, or `MultiChoice`. |
| `value` | JSON value | yes | Template default, compatible with the type and options. |
| `options` | array of `{optionKey,title}` | yes | Choice options; empty for non-choice fields. Keys must be unique. |

Enum names are case-insensitive; the standard JSON enum converter also accepts numeric values: `Integer=0`, `Number=1`, `String=2`, `Boolean=3`, `SingleChoice=4`, and `MultiChoice=5`. Unknown values return `400`.

Values are native JSON. `Integer` accepts int64 values, including integral spellings such as `1.0`; `Number` is a finite IEEE-754 double; `String` includes `""`; `Boolean` accepts both `true` and `false`. `SingleChoice` is one existing option key. `MultiChoice` is an array of unique existing option keys, and an empty array is valid. A saved default must be compatible with the current options.

An omitted field ID generates a new GUID with `typeRevision: 1`. A supplied ID must be active or the request returns `400` (`unknown_field`). Existing keys are immutable. Changing `valueType` increments `typeRevision`; other edits do not. Removing a field from the submitted active list does not delete stored character values. Re-adding the same key creates a new field identity.

## `GET /api/campaigns/{campaignId}/template`

Returns `200` with the campaign's single metadata row:

```json
{"campaignId":7,"name":"Campaign","metadataRevision":1}
```

## `PUT /api/campaigns/{campaignId}/template`

Admin only. Body requires a non-whitespace `name` and `expectedRevision` (int64 >= 1). Success returns `200` metadata with incremented `metadataRevision`; only SQL metadata changes. Missing campaign/template is `404`, stale revision is `409` (`revision_conflict`), and invalid input is `400`.

## `GET /api/campaigns/{campaignId}/template/content`

Returns `200` with the complete content envelope:

```json
{"campaignId":7,"contentRevision":0,"data":{"description":"","baseFields":[],"virtualFields":[]}}
```

The SQL template row exists from campaign creation, while its Mongo document is optional until the first content edit. An absent document is returned logically as empty revision `0`; GET performs no writes. The envelope has no `resourceId`. SQL `metadataRevision` and Mongo `contentRevision` are independent.

## `PUT /api/campaigns/{campaignId}/template/content`

Admin only. Body requires `expectedRevision` (int64 >= 0), `description` (string; empty is allowed), and the complete active `baseFields` array. On a campaign with no content document, revision `0` creates the first document at revision `1`. Repeating revision `0` after creation or submitting a stale revision returns `409` (`content_revision_conflict`) without overwriting content. Later successful compare-and-swap updates increment the shared content revision. Existing `virtualFields` are preserved.

Null required values, invalid field entries, unknown IDs, duplicate active keys/IDs, immutable-key changes, invalid options, and incompatible values return `400`. Missing campaign/template is `404`. Mongo write failures with unknown outcomes return safe `503` (`content_write_outcome_unknown`); Mongo read failures return safe `503` (`dependency_unavailable`).

## `GET /api/campaigns/{campaignId}/template/virtual-fields`

Returns `200` with `{contentRevision,virtualFields}`. It reads the same canonical template content document and revision as the base-field content endpoint; a new or unchanged empty template returns revision `0` and an empty array without writing MongoDB.

## `PUT /api/campaigns/{campaignId}/template/virtual-fields`

Admin only. Body requires `expectedRevision` (int64 >= 0) and the complete `virtualFields` array. Revision `0` creates the first shared template content document at revision `1`; subsequent writes use the same compare-and-swap revision as base-field content. The update preserves `description` and `baseFields`. Formula, binding, field-ID, and validation rules are described in [formulas](formulas.md). Stale revisions return `409` (`content_revision_conflict`); invalid input returns `400`; Mongo failures use the safe errors described above.

Template contents use the `campaignTemplates` MongoDB collection, one document per campaign. The former `templateContents` collection is not read, migrated, or used as a fallback.

## Breaking migration

Migration `20261118000100_CampaignTemplate` removes the old `TemplateMetadata` table and `CharacterMetadata.TemplateId`, creates the shared-primary-key `CampaignTemplates` table, and initializes an empty template for every existing campaign using that campaign's name. Old many-template SQL rows are discarded; old `templateContents` documents are not transferred or selected. The migration cannot automatically restore the old many-template data; downgrade is unsupported. This describes the migration contract, not a claim that any particular database has been migrated.
