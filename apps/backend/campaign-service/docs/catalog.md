# Campaign item and skill catalogs

Items and skills have separate campaign-scoped APIs and persistence namespaces. The application shares generic catalog models and validation algorithms, but item and skill data are not stored in shared catalog tables or collections. SQL uses six tables: `ItemDefinitions`, `CharacterItems`, `ItemAdditionReceipts`, `SkillDefinitions`, `CharacterSkills`, and `SkillAdditionReceipts`. MongoDB uses eight collections: `itemAttributeDefinitions`, `itemContents`, `characterItemContents`, `itemGroups`, `skillAttributeDefinitions`, `skillContents`, `characterSkillContents`, and `skillGroups`.

The standalone service reads the `X-Subject` JSON header `{ "type": "User|Group|Admin", "id": integer }`. It does not itself provide cryptographic authentication. Through API Gateway, the existing Bearer authentication supplies the verified subject; Gateway forwards requests and responses one-to-one without rewriting the body or query.

## Endpoints

The item catalog routes are:

| Method | Path |
| --- | --- |
| `GET`, `POST` | `/api/campaigns/{campaignId}/items` |
| `GET`, `PUT` | `/api/campaigns/{campaignId}/items/{entryId}` |
| `GET`, `PUT` | `/api/campaigns/{campaignId}/items/{entryId}/content` |
| `GET`, `PUT` | `/api/campaigns/{campaignId}/items/attributes` |
| `DELETE` | `/api/campaigns/{campaignId}/items/attributes/{attributeId}?expectedRevision=...` |
| `GET`, `PUT` | `/api/campaigns/{campaignId}/items/groups` |
| `GET` | `/api/campaigns/{campaignId}/items/groups/configuration` |
| `GET` | `/api/campaigns/{campaignId}/items/groups/{groupId}/entries` |

The skill catalog has the same methods and route shapes under `/api/campaigns/{campaignId}/skills`. Item and skill schemas, contents, and groups are independent.

`campaignId` is an integer; resource IDs are GUIDs. JSON properties are camel case. Enums are emitted as names (for example, `Whole`, `Single`, `Definition`, `Character`); defined numeric enum values are also accepted. JSON values remain native JSON, not strings coerced from numbers or booleans.

## Attribute schema and content

Any campaign member may read the scope's schema. If it does not exist, the response has `contentRevision: 0` and an empty `definitions` array. Only campaign administrators may replace it. Each definition is `{ "id", "title", "typeKey", "options" }`. `typeKey` is one of `integer`, `number`, `string`, `boolean`, `singleChoice`, or `multiChoice`; only choice types accept options, whose keys must be unique and non-empty.

Schema replacement is a full replacement. Omitted definitions are deleted; `DELETE .../attributes/{attributeId}?expectedRevision=...` explicitly deletes one definition. Deletion takes effect immediately in all item/skill content, character entry, and group responses: occurrences referencing an attribute no longer in that scope's schema are omitted from reads. GETs do not write or clean documents. The next write to the corresponding object prunes known-deleted occurrences from its current document: catalog content PUT, catalog metadata PUT, character local-attributes PUT, or a Single-item quantity PUT. Stackable items have no local content document to prune. Pruning occurs as part of that subsequent write path; it is not a scan or a background migration.

There is no attribute version/history or value conversion. `contentRevision` is a Mongo document compare-and-set revision; `metadataRevision` is a SQL metadata compare-and-set revision. Neither is an attribute type version. When an existing value is unchanged, its exact stored value may be retained even if it no longer validates against the current definition. Changed values are validated against the current type/options. A new value referring to an unknown/deleted attribute returns `400 unknown_attribute`. A stale full-replacement submission containing a previously stored occurrence bound to a now-deleted attribute is discarded rather than reintroduced.

Attribute occurrences have exactly these four fields:

```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "attributeId": "33333333-3333-3333-3333-333333333333",
  "value": 2,
  "editLevel": "Definition"
}
```

Occurrence `id` is unique within the values array; several occurrences may refer to one `attributeId`. `value` is native JSON. `integer` accepts integral values representable as Int64; `number` accepts finite JSON numbers; `string` and `boolean` require the corresponding primitive; `singleChoice` accepts a current option key; `multiChoice` accepts an array of unique current option keys. `editLevel` is `Definition` or `Character`.

## Definitions and publication

Creating a shared definition is administrator-only. `POST /items` and `POST /skills` require `requestId`, `name`, `isHidden`, `allowNegative`, `description`, and `attributes`; items also require a defined `quantityUnit` (`Whole`, `Fractional`, or `Single`). Skills require `quantityUnit: null` and `allowNegative: false`. Unknown request fields are rejected. `creatorUserId` is derived from a User subject, not supplied by the client.

The definition content is prepared in its scope's Mongo collection before SQL metadata is published. `409 already_published` means the SQL definition exists; `409 content_already_prepared` means content for that resource ID already exists without a confirmed publication. SQL publication uncertainty returns `503 publication_outcome_unknown`; use the same ID to query the definition before deciding what to do. Mongo and SQL do not share a transaction.

Visible definitions can be read by campaign members; hidden definitions are visible only to an administrator or their creator User. Administrators and the creator User may update metadata/content, subject to the existing visibility and ownership checks. A metadata update uses `expectedRevision` from `metadataRevision`; content PUT uses `expectedRevision` from `contentRevision`. Successful conditional writes increment the corresponding revision. Stale writes return `409`.

For content PUT, `description` and the complete `attributes` array are supplied. Omitting an occurrence removes it. An unchanged stored occurrence is allowed even if it is invalid under the current schema; a changed occurrence must be valid under the current schema. Unknown new attribute references return `400`. Public content reads return only occurrences whose `attributeId` remains in the current schema; reads do not mutate Mongo documents.

Per-item quantity semantics, character attachment APIs, and group behavior are described in [character-catalog.md](character-catalog.md) and [catalog-groups.md](catalog-groups.md). This contract does not provide equipment transfer, pricing, or automatic effects.
