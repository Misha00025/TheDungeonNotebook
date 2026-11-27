# Campaign Service

- Read `README.md` and `CONTRIBUTING.md` before changing this service. The README describes the current service/API and data boundaries; the contribution guide defines the required Gateway coordination for API changes.
- Any addition, modification, or removal of a Campaign Service API route must include the corresponding API Gateway route/method changes and cleanup of obsolete proxy routes in the same work iteration.
- Preserve the HTTP contract across the service and Gateway: path, query, body, status codes, `Location`, and `ProblemDetails`. Forward `X-Subject` only from the verified Gateway context; enforce domain access in Campaign Service.
- Update the relevant service and Gateway documentation when changing their API integration, as specified in `CONTRIBUTING.md`.
- Keep SQL/Mongo persistence and domain changes within the requested behavior. Follow existing service patterns for revisions, publication, access checks, and explicit handling of unknown operation outcomes; do not invent new policies or retry behavior.
- Follow the repository-wide deletion rule: do not omit a requested entity deletion operation merely because it has relationships. Define the permitted order and relationship handling without deleting dependent entities implicitly.
- For API changes, consult the service's contribution guide for required service/Gateway verification. Apply the repository-wide test-decision rules; do not add unrelated tests. For other code changes, follow the repository-wide verification rules and the service README commands.
