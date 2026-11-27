# Web

- These instructions apply to `apps/web` and its workspaces, including Hub, remotes, and shared packages.
- Read `CONTRIBUTING.md` before making changes. It documents component ownership, shared SDK APIs, current UI conventions, and relevant commands.
- Keep reusable UI controls and shared styles in `packages/shared`; screen-specific components own API integration, loading state, and permissions.
- Use project SDK components for UI elements when a suitable component exists. Check its public API and established usage before implementing; do not replace it with custom markup/styles or a third-party component.
- If the SDK has no suitable component or cannot meet the requirement, explain the limitation and ask the user rather than introducing a workaround without approval.
- Do not override SDK component internals or styles outside their public API. Keep SDK changes backwards compatible unless the task explicitly permits a breaking change.
- Hub owns global navigation, authentication, and theme. Remotes must not add competing global navigation or their own theme palette.
- Web work must remain within Web. Do not change backend code, API contracts, schemas, migrations, Gateway, or backend documentation as part of a Web task. If the existing API is insufficient, report the limitation and ask for a separate backend task.
- Follow the repository-wide testing rules. Do not add browser tests or tests asserting presentation details such as DOM structure, CSS, colors, spacing, or layout.
