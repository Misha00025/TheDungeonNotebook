# Item and skill catalog groups

Groups are per-kind campaign navigation and selection configuration. Item groups use the `itemGroups` Mongo collection; skill groups use `skillGroups`. Their trees, content revisions, explicit memberships, and conditions are independent. Groups do not create SQL rows, modify definitions, or represent parties, rosters, or ownership.

## Endpoints and access

Each scope has these routes, with `items` or `skills` in place of `{scope}`:

| Method | Path |
| --- | --- |
| `GET`, `PUT` | `/api/campaigns/{campaignId}/{scope}/groups` |
| `GET` | `/api/campaigns/{campaignId}/{scope}/groups/configuration` |
| `GET` | `/api/campaigns/{campaignId}/{scope}/groups/{groupId}/entries` |

Campaign members may read group summaries and entries. Only campaign administrators may read or replace the full configuration. The group singleton uses `Guid.Empty` as its resource ID; a missing document reads as revision zero with an empty group list. PUT is a full replacement using `expectedRevision` as a Mongo content compare-and-set token; it is not an attribute version or global snapshot.

Summary responses contain group IDs, titles, and parent IDs only. Full configuration returns `{campaignId, contentRevision, data:{groups:[...]}, diagnostics}`. Each group has `id`, `title`, nullable `parentId`, `entryIds`, and nullable `condition`. Entry responses contain `{campaignId, groupId, configurationRevision, entries, diagnostics}`; they do not expose an attribute-schema revision. Hidden explicit IDs are only available in administrator-only configuration.

## Tree, explicit membership, and conditions

The configuration is a complete replacement. A group requires a non-whitespace title and `entryIds` array. New group IDs are assigned when omitted; supplied IDs must already exist in the current configuration. Explicit IDs must be unique, non-empty, and refer to definitions in the same catalog scope. A group can explicitly include a hidden definition, but ordinary members only receive entries visible to them. Parent IDs must refer to another submitted group; self-parenting and cycles are rejected. Parent/child relationships provide navigation only and do not inherit membership.

The entries endpoint returns the name/ID-sorted union of explicit visible members and visible definitions matching the stored condition, deduplicated by definition ID. It loads/evaluates only definitions visible to the caller. Explicit membership remains included when the condition is invalid or disabled.

Conditions are JSON trees with `operator` and the applicable leaf/child fields. Supported operators are:

- `all` and `any`: non-empty `children` arrays, with no leaf fields.
- `not`: exactly one child, with no leaf fields.
- `exists`: `attributeId`; true if any occurrence of that attribute is present.
- `eq`: `attributeId` and native JSON `value`; equality uses JSON semantic equality.
- `contains`: `attributeId` and string `value`, for example `{"operator":"contains","attributeId":"...","value":"fire"}`; for `string` attributes it matches a case-sensitive substring, and for `multiChoice` the value must be an existing option key matched exactly, not a substring of an array element. A match in any occurrence is sufficient.
- `gt`, `gte`, `lt`, `lte`: `attributeId` and native JSON `value`; the current attribute definition must be `integer` or `number`.

There are no `typeKey`, type revision, or active-state fields in condition leaves. A leaf comparison uses the currently configured attribute type and options. Numeric values are not coerced from strings. For repeated occurrences, a comparison succeeds if at least one valid occurrence matches; `all` evaluates each child independently, so separate occurrences may satisfy separate children. `not` negates its child, and `exists` tests presence even if an occurrence's value is currently invalid.

## Deleted attributes and diagnostics

If a stored condition refers to an attribute absent from that scope's current schema, the administrator configuration response exposes that group's `condition` as `null`. The group entries endpoint disables automatic matching for that condition; it does not reinterpret the deleted condition as `not(all)` or another predicate. Explicit visible members remain in the result. GET operations do not rewrite the stored configuration. On the next full configuration PUT, resending the old condition still removes the entire condition because its binding is unknown; omitting it also leaves the condition null. Explicit `entryIds` remain independent and are retained when submitted.

The service does not persist historical schema/type snapshots for conditions. Current diagnostics are calculated on reads:

- `invalid_condition`: malformed tree or unsupported operator/shape.
- `incompatible_attribute_type`: a numeric comparison now targets a non-numeric definition, or `contains` targets a type other than `string` or `multiChoice`.
- `invalid_attribute_value`: the condition's native JSON value no longer validates under the current type/options, or an entry occurrence used for a typed condition is invalid.

An absent-attribute reference is filtered to `condition: null` without an `unknown_attribute` diagnostic. An invalid group condition disables automatic matching while explicit visible membership remains. For a valid condition, an entry with an invalid occurrence for a typed condition gets an `invalid_attribute_value` entry diagnostic and is skipped for automatic matching; it is not treated as false under `not`. Diagnostics are read-time only and do not repair or mutate catalog data.

Group configuration revisions are independent for items and skills. Stale PUTs or a concurrent first-create race return `409 content_revision_conflict`. No group-specific data is written to SQL, and a group GET does not clean Mongo content.
