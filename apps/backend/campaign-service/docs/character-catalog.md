# Character catalog entries

Character entries attach campaign catalog items or skills to one character. SQL stores each record's identity, quantity, metadata revision, and an immutable add-request receipt. MongoDB stores only the record's explicit local `CatalogAttributeValue[]` in `characterCatalogContents`; catalog definitions and their source content remain shared campaign data. This API does not create a second inventory document or a separate attribute schema.

## Authentication, identity, and wire format

All endpoints require campaign-service's `X-Subject` JSON header with `{ "type": "User|Group|Admin", "id": integer }` and the existing campaign/character access checks. Standalone service HTTP does not authenticate cryptographically; through Gateway the existing Bearer authentication replaces client-supplied identity and forwards the verified subject. Read requires character access; every write requires character `CanWrite` or campaign administrator access.

JSON names are camel case. `CatalogKind`, `QuantityUnit`, and `AttributeEditLevel` use the existing `JsonStringEnumConverter`: enum names are case-insensitive, and defined numeric enum values are accepted. Unknown enum values are rejected. Quantities are native JSON numbers parsed as CLR `decimal`; values are never accepted as numeric strings. Attribute `value` remains arbitrary native JSON, validated against the shared campaign schema.

All endpoints are under `/api/campaigns/{campaignId}/characters/{characterId}/entries`:

| Method and path | Purpose |
| --- | --- |
| `GET .../entries?kind=Item\|Skill` | List character records; optional kind filter |
| `POST .../entries` | Add a visible catalog entry or merge an identical stack |
| `POST .../entries/create` | Create a private catalog definition and attach its first character record |
| `GET .../entries/{entryId}` | Read one attached record, including a hidden catalog definition |
| `GET .../entries/additions/{requestId}` | Inspect the committed result of an add request |
| `PUT .../entries/{entryId}/quantity` | Change item quantity |
| `PUT .../entries/{entryId}/attributes` | Replace explicit local attributes using content revision CAS |
| `DELETE .../entries/{entryId}?expectedRevision=...` | Explicitly remove one character record |

`entryId` identifies a character record, not its catalog definition. A response contains:

- `record`: `id`, `campaignId`, `characterId`, `catalogEntryId`, `quantity` (nullable), `metadataRevision`.
- `definition`: catalog metadata, including `kind`, hidden state and metadata revision.
- `definitionDescription`, `effectiveAttributes`, and raw `explicitAttributes`.
- `diagnostics`, `schemaRevision`, `definitionContentRevision`, and `localContentRevision`.

The three content/schema revisions are independent reads, not one global snapshot. Effective values do not materialize fallbacks into Mongo. Explicit incompatible values remain present and are returned with diagnostics; the API does not convert, clear, or zero them.

## List and read

### `GET .../entries?kind=Item|Skill`

Returns the character's records, optionally filtered by the definition kind. Every already-attached record is readable to anyone with character read access, even if the catalog definition is hidden from that caller. A definition's Mongo document or a record's local Mongo document missing after SQL publication returns `503 content_unavailable`; it is not returned as empty content. No attached records returns `[]`.

### `GET .../entries/{entryId}`

Returns the same entry envelope as list. The read uses campaign-scoped SQL and Mongo lookups directly after character authorization; it does not apply catalog visibility to an existing attachment.

### `GET .../entries/additions/{requestId}`

Returns `{ "campaignId", "characterId", "requestId", "entryId", "catalogEntryId" }` for a committed add/create receipt. Receipts remain after the character record is explicitly deleted. A request without a committed receipt returns `404`.

## Add an existing catalog entry

### `POST .../entries`

Requires character write access. The strict request object is:

```json
{
  "requestId": "11111111-1111-1111-1111-111111111111",
  "catalogEntryId": "22222222-2222-2222-2222-222222222222",
  "quantity": 2,
  "attributes": []
}
```

`requestId` and `catalogEntryId` are required non-empty GUIDs; `attributes` is required and uses the catalog's `CatalogAttributeValue` shape. Unknown JSON properties are rejected. The definition must be visible in the campaign catalog to the caller, or the caller must administer the campaign. A hidden definition not visible to the caller is `404` for this add operation. This restriction does not affect reads of entries already attached to the character.

For an Item with `Whole` or `Fractional` unit, `quantity` is required. Whole values must be integral. For `Single`, quantity may be omitted/null or equal to `1`; every add creates an independent row, and each row always has quantity 1. For a Skill, quantity must be omitted/null. Negative values are accepted only when the catalog item's `allowNegative` is true. Zero rows are retained for Whole and Fractional items. Decimal overflow returns `400 quantity_overflow`; values are not rounded.

For a new row, `attributes` are explicit Character-level values from the current shared schema. Definition-level catalog occurrences cannot be changed through character state. Existing Character-level source occurrences can receive local overrides; additional Character-level occurrences may use the shared schema. The response is `201 Created` with `Location: .../entries/{entryId}` for a new row.

Example local value (the same shape is used by add, create, and the local attributes PUT):

```json
{"id":"44444444-4444-4444-4444-444444444444","attributeId":"55555555-5555-5555-5555-555555555555","typeKey":"integer","typeRevision":1,"value":3,"editLevel":"Character"}
```

For Whole/Fractional items, the service searches this character's records for the same catalog definition and **exactly the same explicit local attribute set**. Equality includes occurrence IDs, attribute IDs, type key/revision, edit level, and `JsonElement.DeepEquals` value; array order does not matter. It does not compare temporary effective values or materialize fallbacks. If a matching stack exists, its quantity is increased and the receipt points to that record; response is `200 OK`. Different explicit states stay separate.

Skills have no quantity. Re-adding the same skill with the same exact explicit attribute set returns the existing record (`200 OK`); a different state creates another row. Single items always create a separate row.

For example, for a Whole item, adding quantity `2` with `attributes: []`, then adding quantity `3` with `attributes: []` and another request ID, returns `200` for the second call and raises the matching explicit-state stack to `5`. The same requests with a different explicit value or a different occurrence ID do not merge. A Single item can be added with the `quantity` field omitted (or `null`); it creates one new row with quantity `1` each time. A Skill request uses `"quantity":null` or omits quantity, and an identical skill state resolves to the existing row. Example Single and Skill bodies:

```json
{"requestId":"66666666-6666-6666-6666-666666666666","catalogEntryId":"77777777-7777-7777-7777-777777777777","attributes":[]}
```

```json
{"requestId":"88888888-8888-8888-8888-888888888888","catalogEntryId":"99999999-9999-9999-9999-999999999999","quantity":null,"attributes":[{"id":"44444444-4444-4444-4444-444444444444","attributeId":"55555555-5555-5555-5555-555555555555","typeKey":"integer","typeRevision":1,"value":3,"editLevel":"Character"}]}
```

A local quantity update can set Whole/Fractional quantity to zero, or to a negative value when `allowNegative=true`:

```json
{"expectedRevision":1,"quantity":0}
```

```json
{"expectedRevision":2,"quantity":-1.5}
```

Each accepted request creates one SQL receipt in the same SQL transaction as its record/quantity change. Reusing an applied `requestId` returns `409 addition_already_applied`; ProblemDetails `resourceId` contains its original entry ID and `requestId` is unchanged. It does not increment a stack again, including after that row is deleted. Mongo and SQL do not share a transaction. If SQL publication returns `503 publication_outcome_unknown`, first query `GET .../entries/additions/{same requestId}`: a receipt confirms the committed result; `404` means there is no committed receipt. Do not retry with a new ID. A prepared Mongo document is not cleaned up automatically and may make a same-ID retry return `409 content_already_prepared`.

## Create a private definition and attach it

### `POST .../entries/create`

Requires character write access. Request:

```json
{
  "requestId": "33333333-3333-3333-3333-333333333333",
  "definition": {
    "name": "Field tonic",
    "kind": "Item",
    "isHidden": true,
    "quantityUnit": "Whole",
    "allowNegative": false,
    "description": "A character-created item.",
    "attributes": []
  },
  "quantity": 1,
  "attributes": []
}
```

`requestId`, `definition`, and both `attributes` arrays are required. The outer `requestId` is used as the new catalog definition ID, first character record ID, and receipt request ID. The nested definition has no separate request ID. Unknown properties are rejected. A non-administrator must set `definition.isHidden=true`; attempting `false` is `403`. Creator is derived from a User subject, never from the request. Campaign administrators may create hidden or public definitions. Item and Skill metadata constraints are identical to the shared catalog contract in [catalog.md](catalog.md).

Definition source values are validated against the shared schema. The separate outer `attributes` list contains local Character-level values. Both Mongo documents are prepared before SQL publication; catalog definition, character row, and receipt are committed in one SQL transaction. The response is `201 Created` with the same envelope and `Location` as a new add. Reusing the request ID after commit returns `409 addition_already_applied`; an already-published definition ID without this character's receipt is not attached and returns `409`.

On `503 publication_outcome_unknown`, check the receipt endpoint using the same ID. ProblemDetails `resourceId` contains the entry and definition IDs; `requestId` is the operation ID. Do not retry with a new identifier. Mongo documents prepared before an uncertain SQL outcome are not deleted.

## Quantity, local attributes, and deletion

### `PUT .../entries/{entryId}/quantity`

Requires character write access. Body: `{ "expectedRevision": 1, "quantity": 0 }`. `expectedRevision` is the record's SQL `metadataRevision` and must be at least 1. Only Items have quantity. Single accepts only 1; Whole requires an integral decimal; Fractional accepts any representable decimal; negative values require `allowNegative=true`. Zero is retained for Whole/Fractional. A successful update advances only `metadataRevision`, not either Mongo content revision. Stale revisions return `409 revision_conflict`.

### `PUT .../entries/{entryId}/attributes`

Requires character write access. Body: `{ "expectedRevision": 1, "attributes": [] }`; `expectedRevision` is this record's `localContentRevision`, not SQL metadata revision. The complete array is conditionally replaced in Mongo and advances only `localContentRevision`. Values have the same required fields, native JSON validation, and schema rules as catalog attributes. New or changed values must be Character-level and use the current shared schema. An unchanged stale local value may be preserved by a full-array PUT. A local occurrence cannot change the binding of a catalog occurrence, and Definition-level catalog values cannot be changed through this endpoint. Omitting a local occurrence removes that explicit override and exposes the current source/fallback value. No automatic stack merge occurs during state editing; separate records are not deleted or combined. Stale revision returns `409 content_revision_conflict`.

Example setting one explicit value:

```json
{
  "expectedRevision": 1,
  "attributes": [
    {"id":"44444444-4444-4444-4444-444444444444","attributeId":"55555555-5555-5555-5555-555555555555","typeKey":"integer","typeRevision":1,"value":3,"editLevel":"Character"}
  ]
}
```

If a catalog occurrence's binding changes or it becomes Definition-level, its prior local value stays in `explicitAttributes`, receives `attribute_binding_changed` or `edit_level_changed`, and cannot affect the current source value. A local occurrence whose catalog occurrence was removed may remain as a local Character-level input. Diagnostics are computed on reads and never persisted.

### `DELETE .../entries/{entryId}?expectedRevision=1`

Requires character write access and the record's SQL `metadataRevision >= 1`. Deletes only that character row and returns `204 No Content`. It does not delete the shared catalog definition, add receipt, or Mongo content document; Mongo orphan cleanup is not performed. A stale revision is `409 revision_conflict`.

## Error outcomes and scope

- `400`: invalid/unknown request property, GUID, enum, revision, quantity/unit combination, attribute binding/level/value, or `quantity_overflow`.
- `403`: missing/invalid subject, character lacks write permission for mutation, or a non-administrator tries to create a public definition.
- `404`: campaign/character access failure, missing row/receipt, or a hidden catalog definition unavailable for a new add.
- `409`: stale SQL/Mongo revision, applied add receipt (`addition_already_applied`), duplicate/prepared publication, or quantity-policy conflict.
- `503`: missing Mongo content (`content_unavailable`) or SQL commit/publication outcome unknown (`publication_outcome_unknown`).

Definition unit/negative-policy updates and character quantity operations lock the same catalog definition row. A policy change that would make any existing quantity invalid returns `409 quantity_policy_conflict` without changing metadata or quantities. SQL locking order is definition then character. Create-own locks the character before publishing its new definition ID. SQL row/receipt writes are transactional; Mongo revisions remain independent and there is no cross-database transaction or global snapshot.

This slice does not provide groups, parties, equipment, transfer, price, automatic effects, or group ownership.
