# Backend

- These instructions apply to services and shared backend code under this directory.
- Before changing a service, read its `README.md`, any local `CONTRIBUTING.md`, and applicable nested `AGENTS.md` files. Service-local instructions take precedence for that service where they are more specific.
- Keep changes within the requested service and its necessary integration points. Do not modify sibling services or shared contracts as a convenience; report cross-service dependencies that exceed the task scope.
- Preserve existing API and data contracts unless the request explicitly calls for a change. Use the service's existing framework and configuration conventions rather than introducing parallel infrastructure or protocol mechanisms.
- Treat `.env`, data directories, logs, generated build output, and runtime state as operational data, not source files to edit or remove casually. Do not expose credentials in source or documentation.
- For code changes, use the service's documented standard build and permitted unit-test commands. Do not add browser tests.
