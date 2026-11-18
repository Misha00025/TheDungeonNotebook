# Views and presentation contexts

Routes use `/api/campaigns/{campaignId:int}`. Every request must include `X-Subject` with the service's existing subject JSON contract. Campaign administrators may create and update Views and presentation configuration. Other campaign members may read definitions only when `Access:MembersCanReadDefinitions` is enabled. Source projection additionally requires access to the requested character; it never searches other characters.

The service stores View metadata in SQL and View content/configuration in MongoDB. Metadata revisions start at `1`; content revisions start at `1` on insert and increase by one on a successful compare-and-swap. Presentation configuration has one MongoDB document per campaign and uses `Guid.Empty` as its internal resource identifier. A missing document reads as revision `0` with empty dictionaries and does not create a document.

## Node content

`roots` is a required array and may be empty. Every node has `kind`, `nodeKey`, `title`, `params`, and `children`. `kind` is `layout` or `widget`. Both node types may contain either node type in ordered `children`. `nodeKey` is non-whitespace and unique across the complete tree. `title` and `children` are required; `params` is any native JSON value, including explicit `null`.

A Widget additionally requires `sources` (an array) and `format` (any non-null string, including the empty string). A source contains only an explicitly required `kind` (`base` or `virtual`) and `fieldId`; it has no template selector. This source `kind` is distinct from the node `kind` discriminator (`layout` or `widget`); omitting it is invalid rather than defaulting to `base`. Each source must identify an active base or virtual field in the campaign's single canonical template. Foreign-campaign fields and character custom virtual fields are invalid View definitions and return `400 invalid_source`. Layout has no widget-specific fields.

Parameters and format are opaque to this service: it preserves JSON values and strings but does not interpret parameters, parse formats, resolve embedded references, render, or preview a View.

```json
{
  "requestId": "d6c982a2-4394-4843-bab4-31fd51b900a4",
  "name": "Character overview",
  "roots": [
    {
      "kind": "layout",
      "nodeKey": "main",
      "title": "Main layout",
      "params": { "columns": [1, 2], "unknown": { "enabled": true } },
      "children": [
        {
          "kind": "widget",
          "nodeKey": "health",
          "title": "Health widget",
          "params": ["compact", null, { "futureOption": 1234567890123456789 }],
          "children": [
            {
              "kind": "layout",
              "nodeKey": "health-inner-layout",
              "title": "Nested layout",
              "params": null,
              "children": [
                {
                  "kind": "widget",
                  "nodeKey": "health-value",
                  "title": "Current health",
                  "params": { "formatHint": "opaque" },
                  "children": [],
                  "sources": [
                    {
                      "kind": "base",
                      "fieldId": "97378740-5060-4cc5-91f1-946a7cad3fa4"
                    }
                  ],
                  "format": "$1 (${2:s})"
                }
              ]
            }
          ],
          "sources": [],
          "format": "uninterpreted %q / {unknown}"
        }
      ]
    }
  ]
}
```

## Views endpoints

### `GET /views`

- **Headers:** required `X-Subject`.
- **Path:** required integer `campaignId`.
- **Query/body:** none.
- **Access:** definition-read permission.
- **200:** array of metadata `{id, key, campaignId, name, metadataRevision}`. `key` is `id` formatted as GUID `N`.
- **Errors:** `403` absent/invalid subject or access denied, `404` campaign not found (also when a constrained campaign ID is not an integer), `503` dependency unavailable.

### `POST /views`

- **Headers:** required `X-Subject`.
- **Path:** required integer `campaignId`.
- **Query:** none.
- **Body:** required JSON object; `requestId` is required non-empty GUID, `name` is required non-whitespace string, `roots` is required array (possibly empty) of the node types above.
- **Access:** campaign administrator.
- **201:** metadata `{id, key, campaignId, name, metadataRevision, contentRevision}` and `Location` pointing to `GET /views/{id}`.
- **Errors:** `400` invalid body/tree/source or unknown node kind; source must be an active field of this campaign's canonical template; `403` absent/invalid subject or access denied; `404` campaign not found; `409` resource already published or content already prepared; `503` Mongo/SQL unavailable or SQL publication outcome unknown. An unknown SQL publication outcome includes `resourceId`; prepared content is not deleted or retried.

### `GET /views/{id}`

- **Headers:** required `X-Subject`.
- **Path:** required integer `campaignId` and GUID `id`.
- **Query/body:** none.
- **Access:** definition-read permission.
- **200:** View metadata `{id, key, campaignId, name, metadataRevision}`.
- **Errors:** `403` absent/invalid subject or access denied, `404` campaign/View not found (a malformed GUID does not match the constrained route), `503` SQL unavailable.

### `PUT /views/{id}`

- **Headers:** required `X-Subject`.
- **Path:** required integer `campaignId` and GUID `id`.
- **Query:** none.
- **Body:** required `{ "name": string, "expectedRevision": integer }`; name must be non-whitespace and expected revision at least `1`.
- **Access:** campaign administrator.
- **200:** updated metadata; `metadataRevision` is `expectedRevision + 1`.
- **Errors:** `400` invalid body, `403` absent/invalid subject or access denied, `404` campaign/View not found (a malformed GUID does not match the constrained route), `409` metadata revision conflict, `503` SQL unavailable.

### `GET /views/{id}/content`

- **Headers:** required `X-Subject`.
- **Path:** required integer `campaignId` and GUID `id`.
- **Query/body:** none.
- **Access:** definition-read permission.
- **200:** `{campaignId, resourceId, contentRevision, data:{roots:[...]}}`.
- **Errors:** `403` absent/invalid subject or access denied, `404` campaign/View not found (a malformed GUID does not match the constrained route), `503` SQL/Mongo unavailable or published View content missing. This endpoint returns definitions and does not interpret parameters.

### `PUT /views/{id}/content`

- **Headers:** required `X-Subject`.
- **Path:** required integer `campaignId` and GUID `id`.
- **Query:** none.
- **Body:** required `{ "expectedRevision": integer, "roots": [...] }`; revision at least `1`, roots required (may be empty).
- **Access:** campaign administrator.
- **200:** new `{campaignId, resourceId, contentRevision, data:{roots:[...]}}` envelope.
- **Errors:** `400` invalid body/tree/source, `403` absent/invalid subject or access denied, `404` campaign/View not found (a malformed GUID does not match the constrained route), `409` content revision conflict, `503` Mongo/SQL unavailable or published content missing.

### `GET /views/{id}/sources?characterId={guid}`

- **Headers:** required `X-Subject`.
- **Path:** required integer `campaignId` and GUID `id`.
- **Query:** required non-empty GUID `characterId`.
- **Body:** none.
- **Access:** definition-read permission and read access to the specifically requested character.
- **200:** `{viewContentRevision, contentRevision, templateContentRevision, formulaContentRevisions, widgets}`. Each widget item has `nodeKey` and an ordered `sources` array; each source item has its `sourceIndex`, declared `source`, and either `value` or a safe `diagnostic` code. Nested Widgets are included. Base and virtual source kinds remain distinct. Projection resolves sources only against active fields in the campaign's canonical template. A field removed from that template yields `unknown_reference`, even if a character custom virtual field has the same ID. Only declared sources are projected; format and params are not scanned. Revision values describe the observed inputs and do not promise a global snapshot.
- **Errors:** `400` missing/empty/malformed character ID, `403` absent/invalid subject, access denied, or no character assignment, `404` campaign/View/character not found (a malformed path GUID does not match the constrained route), `503` SQL/Mongo dependency unavailable or published content missing.

## Presentation configuration endpoints

`defaults` maps extensible, non-empty context-key strings to View IDs. IDs may be GUID `D` or `N` form and are stored canonically as `N`. `contextParams` maps context keys to arbitrary native JSON values; keys may exist without a corresponding default. There is no fixed list of contexts and no requirement to configure particular contexts.

Example configuration body:

```json
{
  "expectedRevision": 0,
  "defaults": {
    "character-sheet": "d6c982a243944843bab431fd51b900a4",
    "future/encounter-panel": "79a9cf01620242f78dc2d05f87ea96e7"
  },
  "contextParams": {
    "character-sheet": { "density": "compact", "unknown": [true, null] },
    "future/context-without-view": "native JSON string"
  }
}
```

### `GET /presentation`

- **Headers:** required `X-Subject`.
- **Path:** required integer `campaignId`.
- **Query/body:** none.
- **Access:** definition-read permission.
- **200:** `{contentRevision, defaults, contextParams}`. An unconfigured campaign returns revision `0` and empty dictionaries without a MongoDB write.
- **Errors:** `403` absent/invalid subject or access denied, `404` campaign not found (also when a constrained campaign ID is not an integer), `503` Mongo/SQL unavailable.

### `PUT /presentation`

- **Headers:** required `X-Subject`.
- **Path:** required integer `campaignId`.
- **Query:** none.
- **Body:** required `{ "expectedRevision": integer, "defaults": object<string,string>, "contextParams": object<string,JSON> }`; revision is nonnegative, both dictionaries required. Each default must identify a published View in this campaign. Context keys must be non-empty strings; JSON params may be any native JSON value, including `null`.
- **Access:** campaign administrator.
- **200:** `{contentRevision, defaults, contextParams}` with incremented revision and canonical `N` View keys.
- **Errors:** `400` invalid body/context key/View reference, `403` absent/invalid subject or access denied, `404` campaign not found, `409` insert collision or content revision conflict, `503` Mongo/SQL unavailable.

### `GET /presentation/resolve?contextKey={string}`

- **Headers:** required `X-Subject`.
- **Path:** required integer `campaignId`.
- **Query:** required non-empty `contextKey` string; it is not restricted to predefined values or route-like segments.
- **Body:** none.
- **Access:** definition-read permission.
- **200:** `{contextKey, viewMetadata, viewContent, contextParams, contentRevision}`. `contextParams` is the native JSON value for this context or `null` when absent; `contentRevision` is the presentation-config revision. The endpoint returns definitions and parameters only; it does not render or execute them.
- **Errors:** `400` missing/empty context key, `403` absent/invalid subject or access denied, `404` campaign/View not found, `view_not_configured` when no mapping exists, or route mismatch for a non-integer campaign ID, `503` Mongo/SQL unavailable or published View content missing.

## Error response shape

Service errors use `application/problem+json` with `status`, `title`, `detail`, and `code`; resource-specific failures may include `resourceId` and `requestId`. MVC request validation failures return status `400` with `code: "invalid_request"`. Revision conflicts use status `409`. No route adds authentication, TLS, or CORS behavior.
