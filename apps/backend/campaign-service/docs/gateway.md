# API Gateway

Gateway exposes the campaign-service API one-to-one: the external path and upstream path are both `/api/campaigns/...`. The active route list is maintained in [`routes.yaml`](../../api-gateway/configs/routes.yaml); the domain methods and request contracts are documented in [the service API index](README.md) and its linked endpoint pages. The old `/groups/...` and `/polices/...` campaign proxy routes are not served by this Gateway configuration. Updating BFF or Web clients is separate from this Gateway routing contract.

Template routes are singleton paths: `GET`/`PUT /api/campaigns/{campaignId}/template`, `GET`/`PUT .../template/content`, and `GET`/`PUT .../template/virtual-fields`. No plural template catalog, create POST, or template-GUID route is proxied. This is a route-contract change only; Gateway/BFF authentication, verified identity forwarding, request/response passthrough, and body/query transport are unchanged.

Item routes are explicitly proxied one-to-one under `/api/campaigns/{campaignId}/catalog/items`, including `/attributes`, `/attributes/{attributeId}`, and `/groups` with its `configuration` and `{groupId}/entries` reads. Skill routes have the same shape under `/api/campaigns/{campaignId}/catalog/skills`. Character item and skill routes are respectively under `/api/campaigns/{campaignId}/characters/{characterId}/items` and `/skills`; each has its own `create`, `additions/{requestId}`, and record routes. Only item records have a `quantity` route. These routes forward the verified subject and response without parameter injection; detailed contracts are in [catalog.md](catalog.md), [character-catalog.md](character-catalog.md), and [catalog-groups.md](catalog-groups.md).

World-material routes are explicitly proxied under `/api/campaigns/{campaignId}/world/{kind}` for list/create, individual metadata read/update/delete, and individual `/body` read/update. They use the existing campaign upstream and response hooks and forward the verified subject, query, and body unchanged. The service recognizes only `locations`, `organizations`, and `lore`; see [world-content.md](world-content.md).

Full group configuration is administrator-only in campaign-service; Gateway applies no group-specific access hook or parameter injection. The two scopes have separate group configuration and revisions.

Virtual-field inputs use ordinary `bindings` only; the separate parent-field properties are not part of the service contract. Existing template/custom virtual-field and override proxy routes pass their request bodies through without rewrites.

## Authentication and identity

Protected campaign routes require the Gateway's existing Bearer authentication through Account Service. The Gateway does not trust a client-supplied `X-Subject`: it removes supplied identity and credential headers and forwards the subject produced by successful authentication. User subjects identify users; Group subjects identify a campaign and are not Party identities. The Gateway does not inject `userId` into query parameters or request bodies. Campaign-service enforces campaign and character permissions.

## Request and response forwarding

Campaign routes do not configure query/body rewrites or body skipping. Request query parameters and bodies are forwarded as provided by the Gateway proxy mechanism. This includes endpoint-specific inputs such as `expectedRevision` query values and `characterId` on `GET .../views/{viewId}/sources`; creation `requestId` is a JSON body field, distinct from the tracing `X-Request-ID` header.

The campaign response hook uses the PyApiGate response builder's `passthrough` contract. It delegates upstream status and response headers—including `Location` and `application/problem+json` content type—to that standard response handling. JSON response semantics are preserved; byte-for-byte JSON serialization equality is not promised. No campaign DTO wrapping is applied.

The two current-permissions reads are `GET /api/campaigns/{campaignId}/permissions` and `GET /api/campaigns/{campaignId}/characters/{characterId}/permissions`; each is an authenticated one-to-one proxy with the verified `X-Subject` and no parameter injection. See the [permissions contract](permissions.md).

For the supported methods and domain contracts, see [campaigns and members](campaigns.md), [templates](templates.md), [characters](characters.md), [catalog](catalog.md), [character catalog entries](character-catalog.md), [catalog groups](catalog-groups.md), [formulas and virtual fields](formulas.md), and [views and presentation contexts](views.md).
