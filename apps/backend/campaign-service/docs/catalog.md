# Campaign catalog API

The campaign catalog is one campaign-scoped collection of item and skill definitions. SQL stores catalog metadata; MongoDB stores the shared attribute schema and each entry's native JSON content. The standalone service uses HTTP and parses the `X-Subject` JSON header `{ "type": "User|Group|Admin", "id": integer }`; it does not itself provide Bearer or cryptographic authentication. When called through API Gateway, Gateway applies its existing Bearer authentication, replaces any client-supplied subject with the verified context, and forwards that `X-Subject`. Clients must not construct or override the trusted Gateway header. Gateway forwards paths, query, and bodies without rewriting them.

Endpoint paths and methods are: `GET /api/campaigns/{campaignId}/catalog?kind=...`, `POST /api/campaigns/{campaignId}/catalog`, `GET|PUT /api/campaigns/{campaignId}/catalog/{entryId}`, `GET|PUT /api/campaigns/{campaignId}/catalog/{entryId}/content`, and `GET|PUT /api/campaigns/{campaignId}/catalog/attributes`. The only query parameter is optional `kind` on list. No endpoint-specific query or body parameter injection is used.

## Wire conventions and response shapes

`campaignId` is an integer and `entryId` is a GUID. JSON property names are camel case. `JsonStringEnumConverter` emits enum names such as `"Item"`, `"Skill"`, `"Whole"`, and `"Definition"`; it accepts these strings case-insensitively and also accepts numeric enum values. Numeric values are valid only when they identify a defined enum member; unknown values are rejected with `400`. For example, `CatalogKind` ordinals are `0=Item`, `1=Skill`; `QuantityUnit` are `0=Whole`, `1=Fractional`, `2=Single`; `AttributeEditLevel` are `0=Definition`, `1=Character`. The `kind` query binder also accepts enum names case-insensitively or defined numeric values; an unknown numeric value returns `400 invalid_kind`.

All revision values are JSON integers (`long`). Metadata updates require `expectedRevision >= 1`; content writes use their current `contentRevision >= 1`; schema writes allow `expectedRevision >= 0`, with zero meaning the singleton does not yet exist. A successful conditional write increments its revision by one. Stale writes return `409`.

Entry metadata has `id`, `campaignId`, `name`, `kind`, `creatorUserId`, `isHidden`, `quantityUnit`, `allowNegative`, and `metadataRevision`. A content envelope has `campaignId`, `resourceId`, `contentRevision`, `attributeSchemaRevision`, `data`, and `diagnostics`. `data` is returned as stored: JSON values are not stringified, coerced, or cleaned. `attributeSchemaRevision` is the schema revision read for this response; it is not a global snapshot/transaction guarantee. Diagnostics contain `occurrenceId` and one of `unknown_attribute`, `incompatible_attribute_type`, or `invalid_attribute_value`.

## Attribute schema

### `GET /api/campaigns/{campaignId}/catalog/attributes`

Any campaign participant or administrator may read the schema. If no Mongo singleton exists, the response is revision zero with an empty definition list:

```json
{"campaignId":42,"contentRevision":0,"data":{"definitions":[]}}
```

For a populated schema, `data.definitions` contains `{ "id": GUID, "title": string, "typeKey": string, "typeRevision": long, "options": [{ "optionKey": string, "title": string }], "isActive": boolean }` entries.

### `PUT /api/campaigns/{campaignId}/catalog/attributes`

Only a campaign administrator may write. Request body:

```json
{
  "expectedRevision": 0,
  "definitions": [
    {"title":"Rarity","typeKey":"singleChoice","options":[{"optionKey":"common","title":"Common"}],"isActive":true}
  ]
}
```

Definition fields: optional `id` (omission creates a new GUID), required non-empty `title` and `typeKey`, required `options` array, and required `isActive` boolean. Existing IDs must belong to this schema; unknown IDs, empty/duplicate IDs, and invalid option keys return `400`. Type keys are exactly `integer`, `number`, `string`, `boolean`, `singleChoice`, and `multiChoice`. Non-choice types require an empty options array. Choice option keys must be non-empty and unique; titles may be empty.

Omitting an existing definition does not delete it: it is retained with `isActive=false`. Explicit deactivation also retains it. New occurrences cannot reference inactive definitions, but existing occurrences may be carried or edited using the current type/revision. Deactivation alone does not make stored values incompatible. Changing a type key or removing any existing option key increments `typeRevision`; adding options, changing titles, or reordering options does not. Reverting to a previous type increments from the current revision; revisions never roll back. Schema changes do not rewrite or scan catalog content.

First write uses `expectedRevision: 0` and creates the singleton. Concurrent creation or stale replacement returns `409 content_revision_conflict`. Mongo is not transactionally coordinated with SQL; schema writes are Mongo-only.

## Entries and metadata

### `GET /api/campaigns/{campaignId}/catalog?kind=Item|Skill`

Lists visible entries, optionally filtered by `kind`. `kind` is optional. Hidden entries are omitted unless the caller is a campaign administrator or the entry's creator user. The response is an array of metadata objects.

### `POST /api/campaigns/{campaignId}/catalog`

Only a campaign administrator may create. Required request fields are `requestId` (non-empty GUID), `name` (non-whitespace), `kind`, `isHidden` (boolean), `allowNegative` (boolean), `description` (string; empty allowed), and `attributes` (array). `quantityUnit` is nullable and may be omitted or null for `Skill`; for `Item` it must be supplied as a defined unit. Unknown body properties are rejected, including `creatorUserId`, `price`, and any attempt to submit kind-update fields elsewhere.

This shared-catalog POST remains administrator-only. A character writer can create a private definition and attach it through `POST /api/campaigns/{campaignId}/characters/{characterId}/entries/create`; see [character-catalog.md](character-catalog.md).

For `Item`, `quantityUnit` must be `Whole`, `Fractional`, or `Single`. For `Skill`, it must be absent or `null` and `allowNegative` must be false. No quantity magnitude or economic constraints are imposed. Creator is derived only from a User subject; Admin and Group subjects produce `creatorUserId: null`.

Content attributes use the shared value shape described below. Initial attributes are validated against the current schema. On success, the response contains `entry` metadata and `content` (the published content envelope); `Location` is `/api/campaigns/{campaignId}/catalog/{requestId}`. Example:

```json
{
  "requestId":"11111111-1111-1111-1111-111111111111",
  "name":"Healing potion",
  "kind":"Item",
  "isHidden":false,
  "quantityUnit":"Whole",
  "allowNegative":false,
  "description":"Restores health.",
  "attributes":[{"id":"22222222-2222-2222-2222-222222222222","attributeId":"33333333-3333-3333-3333-333333333333","typeKey":"integer","typeRevision":1,"value":2,"editLevel":"Definition"}]
}
```

The content document is prepared in Mongo before SQL metadata publication. `409 already_published` means metadata already exists; `409 content_already_prepared` means the same resource ID has an unpublished/prepared document. On SQL write uncertainty the service returns `503 publication_outcome_unknown`, with resource and request IDs. Mongo content is not deleted and the request must not be retried with a new ID. Resolve by querying `GET /api/campaigns/{campaignId}/catalog/{same requestId}` and, when published, its `/content` endpoint. Prepared orphan content remains unavailable through public reads.

### `GET /api/campaigns/{campaignId}/catalog/{entryId}`

Returns metadata when the entry is public, the caller is its creator user, or the caller administers the campaign. A hidden entry belonging to someone else is reported as `404`.

### `PUT /api/campaigns/{campaignId}/catalog/{entryId}`

Administrators and the creator user can update metadata; other callers who can see the entry receive `403`. Hidden entries owned by someone else remain `404`. Required: `name`, `expectedRevision`; optional metadata fields are `isHidden`, `quantityUnit`, and `allowNegative`. `kind` and `creatorUserId` are not accepted. Only administrators may change `isHidden`; a creator may submit its unchanged value. Item quantity unit remains required and Skill constraints remain fixed. Example:

```json
{"name":"Greater healing potion","expectedRevision":1,"quantityUnit":"Whole","allowNegative":false}
```

## Content

### `GET /api/campaigns/{campaignId}/catalog/{entryId}/content`

Uses the same visibility rules as metadata GET. Returns raw `data` and per-occurrence diagnostics; it does not remove or convert invalid/stale stored values. A published SQL entry with missing Mongo content returns `503 content_unavailable`, never an empty content document.

### `PUT /api/campaigns/{campaignId}/catalog/{entryId}/content`

Administrators and creator users may update content under the metadata visibility rules. Request body requires `expectedRevision`, `description` (empty allowed), and `attributes` array. Each attribute is the same object used at creation:

```json
{"expectedRevision":1,"description":"Restores health.","attributes":[{"id":"22222222-2222-2222-2222-222222222222","attributeId":"33333333-3333-3333-3333-333333333333","typeKey":"integer","typeRevision":1,"value":2,"editLevel":"Definition"}]}
```

`id` identifies an occurrence, so multiple occurrences may share `attributeId`; occurrence IDs must be unique and non-empty. `value` is native JSON. `integer` accepts only integral JSON numbers representable as Int64; `number` accepts finite JSON numbers; `string` and `boolean` require corresponding JSON primitives; `singleChoice` requires a current option key string; `multiChoice` requires an array of unique current option key strings. `editLevel` is `Definition` or `Character`; it records the allowed-edit level of that application, not a value type. Character-level values may be overridden or added on an attached character record through the [character catalog API](character-catalog.md); Definition-level values remain catalog-controlled.

New or changed occurrences require a known attribute, current matching `typeKey` and `typeRevision`, and a valid native JSON value. An identical existing occurrence (including `JsonElement.DeepEquals` value) can be retained even if its schema is stale, so a description-only edit does not erase/block it. Changing its value or attribute binding requires current validation. Individual occurrences can be removed by omitting their occurrence ID. Unknown attribute, incompatible type, invalid value, empty/duplicate occurrence ID, undefined JSON value, or invalid edit level returns `400`. No diagnostics are persisted.

## Status codes, permissions, and exclusions

- `400`: malformed/unknown request properties, required fields or enum values, invalid metadata, schema, occurrence, or native value.
- `403`: missing/invalid subject, non-administrator schema write/create, or a visible entry write by a non-owner/non-administrator.
- `404`: campaign access failure via the existing campaign service, missing entry, or hidden entry not visible to caller.
- `409`: stale schema/content/metadata revision, duplicate publication, or content already prepared for that ID.
- `503`: published content missing (`content_unavailable`) or SQL publication outcome not confirmable (`publication_outcome_unknown`).

There is no delete endpoint for attribute definitions or shared catalog entries: definitions are deactivated by schema replacement, and shared catalog entries have no delete/archive operation. Attached character records can be explicitly deleted through the [character catalog API](character-catalog.md). Groups, parties, equipment, transfer, price, and automatic effects are out of scope.
