# World materials

World materials are campaign-scoped records in the SQL `WorldMaterials` table, separate from item and skill catalogs. The supported `kind` path values are exactly `locations`, `organizations`, and `lore`.

All endpoints are under `/api/campaigns/{campaignId}/world/{kind}`:

| Method and path | Contract |
| --- | --- |
| `GET /` | List visible cards; optional `?tag=` filters by exact tag string. Bodies are not read. |
| `POST /` | Create with `requestId`, `title`, `description`, `tags`, and `body`. Publication starts false. Returns `201` and the material card/body version. |
| `GET /{id}` | Read one visible material card. |
| `PUT /{id}` | Update `title`, `description`, `tags`, `isPublished`, and `expectedRevision`. |
| `DELETE /{id}?expectedRevision=` | Delete the metadata row and then remove its body file. |
| `GET /{id}/body` | Read `{ body, bodyVersion }`. |
| `PUT /{id}/body` | Update `{ body, expectedVersion }`; returns the body and its new version. |

Titles must contain non-whitespace characters. Description, tags, and body are required; description and body may be empty. Tags are non-empty strings, preserved as supplied and matched exactly for filtering. Metadata revisions and body versions are independent. Body versions are lowercase hexadecimal SHA-256 of the file's UTF-8 bytes.

Campaign access is required. Campaign administrators (campaign master, matching Group, or global Admin) can create, edit, publish, delete, and read all materials. Other campaign members can read only published materials. Non-members follow the existing campaign `404` access contract. Unknown kinds and unavailable/unpublished materials are `404`.

Each body is stored as UTF-8 Markdown at `{WorldContent:RootPath}/{campaignId}/{guid}.md`; titles, kinds, and request paths do not form filesystem paths. The default root path is the relative `world-content`. A per-material lock file serializes creation, body replacement, and deletion across processes. SQL metadata and files do not share a transaction. A failed SQL publication with an unknown outcome returns `publication_outcome_unknown` and retains the prepared file. Missing published body files are content errors, not empty bodies.

The route proxy definitions are in the Gateway [`routes.yaml`](../../api-gateway/configs/routes.yaml), with the routing overview in [`gateway.md`](gateway.md).
