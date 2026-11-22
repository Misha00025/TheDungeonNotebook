# API Gateway

Gateway exposes the campaign-service API one-to-one: the external path and upstream path are both `/api/campaigns/...`. The active route list is maintained in [`routes.yaml`](../../api-gateway/configs/routes.yaml); the domain methods and request contracts are documented in [the service API index](README.md) and its linked endpoint pages. The old `/groups/...` and `/polices/...` campaign proxy routes are not served by this Gateway configuration. Updating BFF or Web clients is separate from this Gateway routing contract.

Template routes are singleton paths: `GET`/`PUT /api/campaigns/{campaignId}/template`, `GET`/`PUT .../template/content`, and `GET`/`PUT .../template/virtual-fields`. No plural template catalog, create POST, or template-GUID route is proxied. This is a route-contract change only; Gateway/BFF authentication, verified identity forwarding, request/response passthrough, and body/query transport are unchanged.

Catalog endpoints have explicit one-to-one routes and are listed in the [catalog contract](catalog.md). They use the same verified subject and response forwarding.

Character catalog endpoints are also explicit one-to-one routes under `/api/campaigns/{campaignId}/characters/{characterId}/entries`; exact methods and request contracts are in [character-catalog.md](character-catalog.md). The receipt check, `create`, `quantity`, `attributes`, and explicit record deletion paths use the same verified subject and response forwarding.

Virtual-field inputs use ordinary `bindings` only; the separate parent-field properties are not part of the service contract. Existing template/custom virtual-field and override proxy routes pass their request bodies through without rewrites.

## Authentication and identity

Protected campaign routes require the Gateway's existing Bearer authentication through Account Service. The Gateway does not trust a client-supplied `X-Subject`: it removes supplied identity and credential headers and forwards the subject produced by successful authentication. User subjects identify users; Group subjects identify a campaign and are not Party identities. The Gateway does not inject `userId` into query parameters or request bodies. Campaign-service enforces campaign and character permissions.

## Request and response forwarding

Campaign routes do not configure query/body rewrites or body skipping. Request query parameters and bodies are forwarded as provided by the Gateway proxy mechanism. This includes endpoint-specific inputs such as `expectedRevision` query values and `characterId` on `GET .../views/{viewId}/sources`; creation `requestId` is a JSON body field, distinct from the tracing `X-Request-ID` header.

The campaign response hook uses the PyApiGate response builder's `passthrough` contract. It delegates upstream status and response headers—including `Location` and `application/problem+json` content type—to that standard response handling. JSON response semantics are preserved; byte-for-byte JSON serialization equality is not promised. No campaign DTO wrapping is applied.

The two current-permissions reads are `GET /api/campaigns/{campaignId}/permissions` and `GET /api/campaigns/{campaignId}/characters/{characterId}/permissions`; each is an authenticated one-to-one proxy with the verified `X-Subject` and no parameter injection. See the [permissions contract](permissions.md).

For the supported methods and domain contracts, see [campaigns and members](campaigns.md), [templates](templates.md), [characters](characters.md), [catalog](catalog.md), [character catalog entries](character-catalog.md), [formulas and virtual fields](formulas.md), and [views and presentation contexts](views.md).
