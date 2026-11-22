# Campaign catalog groups

Catalog groups organize shared item and skill definitions for navigation and selection. They are a campaign-scoped Mongo singleton in `catalogGroups`, with their own `contentRevision`; they do not add SQL rows or modify catalog entries. A group's `parentId` describes navigation only: children are not automatically members of a parent's entry set. Groups are not parties, rosters, or character ownership.

## Authentication and wire format

The standalone service uses HTTP and the `X-Subject` JSON header `{ "type": "User|Group|Admin", "id": integer }`; it does not provide cryptographic authentication itself. Through Gateway, existing Bearer authentication replaces client-provided identity with the verified subject. Campaign membership/administration is checked by campaign-service. Group configuration is administrator-only; group summary and entry reads are available to campaign members.

JSON property names are camel case. `campaignId` is an integer; group, parent, attribute, and catalog entry IDs are GUIDs. `CatalogKind`, `QuantityUnit`, and `AttributeEditLevel` use the existing `JsonStringEnumConverter`; enum strings are case-insensitive and defined numeric values are accepted. Unknown request properties and condition properties are rejected. `TypeKey` is a string key from the shared catalog schema, not an enum. Condition `value` is native JSON and is validated with the same catalog attribute rules; values are not converted to strings.

The singleton collection resource ID is `Guid.Empty`, scoped by `campaignId`. If no document exists, its revision is zero and its group list is empty. A successful PUT increments `contentRevision`; schema `contentRevision` is returned separately as `attributeSchemaRevision`. These revisions are independent reads, not one global snapshot.

## Endpoints

### `GET /api/campaigns/{campaignId}/catalog/groups`

Any campaign member or administrator may read summaries. Response:

```json
{
  "campaignId": 42,
  "contentRevision": 1,
  "groups": [
    {"id":"11111111-1111-1111-1111-111111111111","title":"Weapons","parentId":null},
    {"id":"22222222-2222-2222-2222-222222222222","title":"Melee","parentId":"11111111-1111-1111-1111-111111111111"}
  ]
}
```

This route deliberately does not return `entryIds` or `condition`, so hidden catalog IDs and predicates are not exposed to ordinary members.

### `GET /api/campaigns/{campaignId}/catalog/groups/configuration`

Only a campaign administrator may read the complete configuration. Response includes `{campaignId, contentRevision, data:{groups:[...]}, attributeSchemaRevision, diagnostics:[...]}`. Each full group has `id`, `title`, nullable `parentId`, `entryIds`, and nullable `condition`. Diagnostics have `groupId`, nullable `entryId`, and `code`. This is the editor/readback representation and includes hidden explicit member IDs and retained stale predicates; ordinary members cannot call it.

### `PUT /api/campaigns/{campaignId}/catalog/groups`

Only a campaign administrator may replace the full configuration. Body:

```json
{
  "expectedRevision": 0,
  "groups": [
    {"title":"Weapons","parentId":null,"entryIds":["33333333-3333-3333-3333-333333333333"]},
    {"title":"Strong weapons","parentId":null,"entryIds":[],"condition":{"operator":"gte","attributeId":"44444444-4444-4444-4444-444444444444","typeKey":"integer","typeRevision":1,"value":10}}
  ]
}
```

The body is a complete replacement. `expectedRevision` is required and nonnegative; zero creates the singleton. Each group requires a non-whitespace `title` and `entryIds` array. `id` is optional: omitted IDs receive server identities; a supplied ID must already exist in this configuration. Empty or duplicate group IDs are `400`. Omitted groups are removed from the configuration only; their catalog definitions are untouched. Existing groups can be reordered or renamed without changing identity.

`parentId` is nullable and must refer to another group in the same submitted configuration. Self-parenting, unknown parents, deleting a parent while retaining a child that references it, and any cycle are rejected with `400`. Parent links provide navigation only and never contribute entries to a child or parent result automatically. There is no imposed hierarchy-depth limit.

Every explicit `entryIds` value must be non-empty, unique within its group, and refer to catalog metadata in the same campaign. Administrators may explicitly include hidden entries. The same entry can belong explicitly to more than one group. No reverse group IDs are stored on catalog entries.

### `GET /api/campaigns/{campaignId}/catalog/groups/{groupId}/entries`

Any campaign member or administrator may read one group's entries. Unknown group IDs return `404`. Response:

```json
{
  "campaignId":42,
  "groupId":"11111111-1111-1111-1111-111111111111",
  "configurationRevision":1,
  "attributeSchemaRevision":2,
  "entries":[{"id":"33333333-3333-3333-3333-333333333333","campaignId":42,"name":"Longsword","kind":"Item","creatorUserId":null,"isHidden":false,"quantityUnit":"Whole","allowNegative":false,"metadataRevision":1}],
  "diagnostics":[]
}
```

`entries` is a stable name/ID-sorted union of explicit visible memberships and visible automatic matches. Results are deduplicated by catalog entry ID. A child's members are not included through its parent. This endpoint has no client-provided filter or condition parameter; all filtering uses the stored group configuration.

## Condition tree

`condition` is either null/omitted or a tree with exact lowercase operator keys. It is a small JSON data structure, not a script, query language, plugin, or executable expression. Unknown properties are rejected.

- `all` and `any`: require a non-empty `children` array and allow no leaf fields (`attributeId`, `typeKey`, `typeRevision`, `value`).
- `not`: requires exactly one child and allows no leaf fields.
- `exists`: requires a known non-empty `attributeId`; `typeKey`, `typeRevision`, `value`, and `children` must be absent. It tests presence of an occurrence and does not require a value type.
- `eq`: requires `attributeId`, current `typeKey`, current positive `typeRevision`, and defined `value`; it has no children. `value` is validated with `CatalogAttributeValues.IsValueValid`, so the supported type keys and native-value rules are identical to [catalog attributes](catalog.md).
- `gt`, `gte`, `lt`, `lte`: same required typed leaf fields as `eq`, but only for `integer` and `number` attributes.

For repeated occurrences of one attribute, a leaf is true when at least one valid occurrence satisfies it. `all` evaluates each child independently, so two leaves for one `attributeId` can be satisfied by two different occurrences. `not` negates the child result; an absent attribute makes `eq` false and therefore `not(eq)` true. `exists` is true when any occurrence with that `attributeId` is present, even if its value is stale.

Equality uses native `JsonElement.DeepEquals`. Integer comparisons use `Int64` comparison when possible, otherwise exact decimal comparison; numeric comparisons use decimal when both values fit, otherwise finite double comparison. Numeric strings are not parsed or coerced.

New or changed condition trees are checked against the current shared campaign schema. A new group or a new attribute reference cannot use an inactive attribute. An attribute reference already used by the same group's previous condition may be edited using its current type, revision, and value rules even after deactivation; deactivation alone does not diagnose or disable that existing condition. A structurally unchanged condition may also be retained during a full PUT after its type/revision/value becomes stale. The service never rewrites or deletes conditions when the schema changes.

## Evaluation, visibility, and diagnostics

Before loading source content or evaluating automatic membership, campaign-service obtains catalog entries visible to the caller using the existing catalog access rules. A hidden definition unavailable to the caller is excluded before any content read, evaluation, or entry diagnostic; it does not reveal hidden IDs, counts, or predicate results. Explicit hidden memberships are still present in administrator-only configuration. An already-visible explicit membership remains part of the union even if the group's condition is stale.

Condition/schema diagnostics use these stable codes:

- `invalid_condition`: malformed stored tree.
- `unknown_attribute`: a stored condition refers to an attribute absent from the current schema.
- `incompatible_attribute_type`: stored leaf type key/revision differs from the current definition or a numeric operator no longer applies to a numeric type.
- `invalid_attribute_value`: stored leaf value no longer validates against its current definition.

Group-level diagnostics have `entryId:null`; they disable automatic evaluation for that group's condition while preserving explicit visible membership. For a valid group condition, if a visible catalog entry has an occurrence of a typed condition attribute whose type/revision/value is incompatible, evaluation for that entry is unknown: the service emits an entry diagnostic and skips its automatic match. It does not treat the result as false, especially under `not`. If a repeated attribute has both valid and incompatible occurrences, the entry is diagnosed and no partial occurrence set is evaluated. `exists` checks occurrence presence only. Hidden entries are never loaded to produce diagnostics for an ordinary member.

Catalog content documents are read through the existing campaign-scoped API. A visible published catalog entry whose Mongo content is missing returns `503 content_unavailable`, not a silent omission. Condition diagnostics are computed at read time and are not persisted.

## Revisions, access, and errors

- `GET groups` and `GET group entries`: any campaign member/admin after existing campaign access checks.
- `GET configuration` and `PUT groups`: campaign administrator only.
- `expectedRevision` must be `>=0`; a successful create or replacement advances config `contentRevision` by one. Stale revision or a creation race returns `409 content_revision_conflict`.
- `400`: unknown JSON properties, empty/duplicate IDs, invalid title/parent graph/explicit members, malformed condition, invalid operator/type/value, or missing/invalid revision.
- `403`: missing/invalid subject or a non-administrator reads/writes full configuration.
- `404`: campaign access denial through the existing campaign service, or unknown requested group.
- `409`: stale configuration revision or singleton creation race.
- `503`: normal Mongo content-store unavailability.

No SQL schema, entry metadata, character inventory, party, roster, or deployment policy is introduced by catalog groups. They only govern group summaries and the campaign-wide catalog entry selector API.
