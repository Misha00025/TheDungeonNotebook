# BFF

- These instructions apply to the BFF project in `web/`.
- Read `web/README.md` before changing BFF behavior, configuration, or delivery. It describes the current authentication flow, configuration ownership, and integration boundaries.
- Keep OAuth tokens and session credentials server-side. Do not expose tokens, claims, or session keys to browser clients.
- BFF handles browser authentication/session transport and forwards authenticated API traffic to the existing API Gateway. Do not move domain permissions or TDN profile ownership into BFF.
- Preserve the separation between local BFF session logout and completion of the external identity-provider logout; do not claim the latter succeeded unless the flow actually completes.
- Treat external origins, identity-provider settings, and other operational values as configuration. Never place real credentials in source, examples, or documentation.
- Keep BFF changes scoped to `apps/bff`; do not modify Gateway, other backend services, or Web unless the user explicitly scopes a separate coordinated task.
- Follow the repository-wide testing rules and the project’s standard .NET build checks for code changes.
