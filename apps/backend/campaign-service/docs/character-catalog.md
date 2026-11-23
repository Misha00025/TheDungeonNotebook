# Character items and skills

Items and skills attach to a character through separate routes and separate SQL/Mongo namespaces. Shared generic service logic does not mean shared records or collections. SQL rows and add receipts are transactional together. Mongo content is independently stored and revisioned; there is no cross-database transaction.

Reads require character read access; writes require character `CanWrite` or campaign administrator access. Existing attached entries remain readable to an authorized character reader even when their definition is hidden from that reader. A new add requires the definition to be visible to the caller. A creator is derived from the actual User subject, never from client input. A non-administrator creating a private definition must make it hidden; campaign administrators may create hidden or public definitions.

## Endpoints

Items use `/api/campaigns/{campaignId}/characters/{characterId}/items`:

| Method | Suffix | Purpose |
| --- | --- | --- |
| `GET`, `POST` | *(none)* | List or add an item |
| `POST` | `/create` | Create a definition and attach its first item record |
| `GET` | `/additions/{requestId}` | Look up an add receipt |
| `GET`, `DELETE` | `/{entryId}` | Read or delete an attached record |
| `PUT` | `/{entryId}/quantity` | Update an item quantity |
| `PUT` | `/{entryId}/attributes` | Replace local attributes |

Skills use the same routes under `/api/campaigns/{campaignId}/characters/{characterId}/skills`, except there is no quantity PUT. Each scope has its own definition, character-content, and receipt collections/tables.

`entryId` identifies a character record; `catalogEntryId` identifies its definition. The response envelope contains `record`, `definition`, `definitionDescription`, `effectiveAttributes`, `explicitAttributes`, `definitionContentRevision`, and `localContentRevision`. There are no attribute diagnostics or schema revision fields in this envelope. `record` contains `id`, `campaignId`, `characterId`, `catalogEntryId`, nullable `quantity`, and `metadataRevision`; definition metadata has no `kind` field.

Character add request example:

```json
{
  "requestId": "11111111-1111-1111-1111-111111111111",
  "catalogEntryId": "22222222-2222-2222-2222-222222222222",
  "quantity": 2,
  "attributes": []
}
```

`requestId`, `catalogEntryId`, and `attributes` are required; IDs must be non-empty GUIDs. The request rejects unknown JSON properties. `CatalogAttributeValue` has exactly `id`, `attributeId`, native JSON `value`, and `editLevel`; see [catalog.md](catalog.md) for validation rules. `metadataRevision` is a SQL metadata compare-and-set revision. `definitionContentRevision` and `localContentRevision` are independent Mongo compare-and-set revisions. None is an attribute type version or a global snapshot.

## Item quantities and stack rules

- `Whole` and `Fractional` item adds require a quantity and have at most one character row per character and definition. An add to an existing row sums the requested quantity; explicit state is not compared. A second row for that pair causes `SingleOrDefault` to fail rather than selecting an arbitrary row.
- Stackable item adds require an empty local `attributes` array. A non-empty array returns `400 stack_state_not_supported`. Stackable rows have no local Mongo document; the response reports `localContentRevision: 0` and no explicit local attributes.
- `Single` items always create a separate row with quantity `1`; quantity may be omitted/null or exactly `1`. Each row has local content, including when its attributes array is empty.
- Every skill add creates a separate row, even when the definition and local state match an existing skill. Skill `quantity` must be null or omitted and is always null in the row.

`Whole` quantities must be integral; `Fractional` accepts representable decimals. Zero is retained. Negative quantity is accepted only when the item's `allowNegative` is true. A stack sum that overflows or cannot be represented exactly returns `400 quantity_overflow`; values are not rounded. Quantity updates use `expectedRevision` equal to the record's `metadataRevision`; successful writes increment that revision. A stale write returns `409 revision_conflict`.

A newly created record returns `201 Created`; adding to an existing stack returns `200 OK`. Every skill add creates a new record and returns `201 Created`.

Switching an item's unit between `Single` and a stackable unit while attached rows exist returns `409 quantity_policy_conflict`; rows are never transformed or merged during metadata updates. A metadata change that makes an attached quantity violate the current `Whole`/`Fractional` or negative-value policy also returns `409 quantity_policy_conflict`.

## Local state, overrides, and fallback

Every `Single` item and every skill has a local Mongo document. Its attributes are explicit character-level values. A matching `Character`-level definition occurrence can be overridden locally; otherwise the current definition value remains the live fallback. Additional local Character-level occurrences are supported. Effective values are composed for the response and are not materialized as fallback copies in Mongo. A local numeric zero is an explicit value and is retained, not treated as absent. Definition-level occurrences cannot be changed locally.

`PUT .../{entryId}/attributes` replaces the complete local attributes array. Its `expectedRevision` is the current `localContentRevision`; successful replacement advances that revision. Omitting a local occurrence removes that explicit override and exposes the current source/fallback value. Changed/new local values must use `editLevel: "Character"` and validate against the current schema. An unchanged stored value can be retained even if it is no longer valid under the current type/options. A stale submission for an occurrence whose attribute was deleted is discarded; it is not restored. `contentRevision` is a document CAS token, not an attribute-type version.

For stackable items, local attributes are unsupported and there is no local document to update. For `Single` items, a quantity PUT also runs the pruning path for known-deleted local occurrences. Reads omit occurrences whose attributes are deleted but do not write or clean Mongo. A later content write prunes known-deleted occurrences from that local document.

If a published non-stackable item or skill has no local Mongo document, reads and local updates return `503 content_unavailable`; the service does not synthesize an empty document or revision zero. Missing definition content also returns `503 content_unavailable`.

## Private definition creation and add receipts

`POST .../create` takes an outer `requestId`, a `definition` object (`name`, `isHidden`, `quantityUnit`, `allowNegative`, `description`, `attributes`), optional item quantity, and required outer local `attributes`. The request ID is the new definition ID, first record ID, and receipt request ID. For a stackable item, outer local attributes must be empty. The definition and applicable local content are prepared in Mongo before SQL publication.

Each accepted add/create writes one SQL receipt in the same SQL transaction as the quantity or rows. Reusing an applied request ID returns `409 addition_already_applied`; it does not apply the operation a second time, including after the row is deleted. Look up the outcome with `GET .../additions/{requestId}`. Duplicate publication returns `409`; already-prepared Mongo content returns `409 content_already_prepared`. If a SQL write/commit outcome is unknown after publication begins, the service returns `503 publication_outcome_unknown`, with the entry and catalog-entry IDs in `resourceId` and the operation ID in `requestId`. Check the receipt endpoint using that same request ID before taking further action; do not retry with a new ID. Mongo and SQL do not share a transaction, and prepared Mongo documents are not automatically removed.

Deleting an attached record requires its current SQL `metadataRevision` as `expectedRevision` and returns `204`. It removes the SQL row only; it does not remove the definition, receipt, or Mongo content. A stale revision returns `409 revision_conflict`.

## Access and common errors

- `400`: malformed request, invalid quantity/unit/attribute, or `stack_state_not_supported` / `quantity_overflow`.
- `403`: write access denied, or a non-administrator attempts to create a public character-owned definition.
- `404`: missing record/receipt or a definition hidden from the caller during a new add.
- `409`: stale revision, `addition_already_applied`, duplicate/prepared publication, or `quantity_policy_conflict`.
- `503`: missing published Mongo content (`content_unavailable`) or uncertain SQL publication (`publication_outcome_unknown`).

See [catalog-groups.md](catalog-groups.md) for per-scope navigation groups. This API does not provide party/roster membership, item transfer, pricing, or automatic effects.
