# api-gateway Service Rules

## Project Structure
```
api-gateway/
├── app/
│   ├── __init__.py               # Flask app, PrometheusMetrics, engine bootstrap
│   ├── routes.yaml               # ~67 declarative endpoints (корень сервиса)
│   ├── engine/
│   │   ├── bootstrap.py          # Load YAML → create Blueprint → register routes
│   │   ├── models.py             # RouteConfig, GatewayConfig dataclasses
│   │   ├── context.py            # RouteContext: request, jwt, services, path_params
│   │   ├── registry.py           # ServiceRegistry + 3 handler registries
│   │   ├── loader.py             # Parse routes.yaml
│   │   ├── pipeline.py           # validate → access → proxy/respond
│   │   └── proxy.py              # Forward request to backend
├── handlers/                     # Любой .py файл здесь авто-импортируется при старте
│   ├── __init__.py               # Авто-импорт через pkgutil
│   ├── access.py                 # @register_access_handler("group_member"), etc.
│   └── responses.py              # @register_response_handler("handler_name")
│   ├── security/                 # JWT validation helpers
│   └── services/                 # Legacy HTTP clients (engine overrides these)
├── wsgi.py                       # Gunicorn entrypoint
├── main.py                       # Dev server (debug=True)
├── Dockerfile                    # python:3.13, gunicorn, port 5000
├── req.txt
└── tests/                        # Integration tests (see rules/tech-testing.md)
```

## Declarative Engine
- **All new routes must go into `routes.yaml`** (корень сервиса) — do NOT add `@route` decorators
- Engine creates a Flask `Blueprint` with `base_path` from YAML (default `/v2/`)
- Pipeline per route: `validate → access → proxy` (or `response` for custom handlers)
- `base_url` сервисов поддерживает подстановку `${ENV_VAR}` и `${ENV_VAR:-default}`

## RouteConfig fields (in routes.yaml)
```yaml
routes:
  - path: "/groups/{groupId}"
    methods: ["GET"]
    service: campaign
    access: ["group_member"]
    response: null           # null = proxy to backend
    transform: null          # optional post-proxy transform
```

## Handler Registries
```python
Любой `.py` файл в `handlers/` автоматически импортируется при старте через `pkgutil.iter_modules`. Не нужно вручную добавлять импорты в bootstrap.

```python
from app.engine.registry import (
    register_access_handler,
    register_response_handler,
    register_response_transform,
)

@register_access_handler("group_admin")
def check_group_admin(ctx: RouteContext) -> bool: ...

@register_response_handler("get_api")
def handle_get_api(ctx: RouteContext): ...
```

> **Примечание:** `app.` imports внутри хендлеров (например `from app.engine.context`) работают, т.к. корень проекта (`api-gateway/`) находится в `sys.path`.

## RouteContext
```python
ctx.request      # Flask request
ctx.jwt          # Decoded JWT payload (dict) or None
ctx.path_params  # URL path params {groupId: "123"}
ctx.services     # ServiceRegistry instance
ctx.services.campaign.get("/groups/1")
ctx.services.campaign.post("/groups", json={...})
```

## ServiceRegistry
```python
ctx.services.auth
ctx.services.users
ctx.services.campaign
```

## Security
- Client params `userId` and `access` are **stripped** from incoming requests (`_sanitize_user_params` in `__init__.py`)
- JWT validated **locally** via RSA public key (`PUBLIC_KEY`) in `pipeline.py:_validate_jwt` — no call to auth-service
- CORS is **disabled by default**. Set `CORS_ENABLED=1` (or `true`/`yes`) to enable.  
  Allowed origins are configured via `CORS_ORIGINS` (default `*`).
- Service URL env vars: `USERS_SERVICE_URL`, `CAMPAIGN_SERVICE_URL`
- `AUTH_SERVICE_URL` is removed — gateway does not communicate with auth-service directly

## Boot Order
1. `app/engine/` modules loaded
2. `handlers/` imported (авто-импорт через `import handlers`)
3. `routes.yaml` parsed
4. Blueprint created and registered on Flask app

## Dependencies
Flask 3.x, Gunicorn, prometheus-flask-exporter, requests, PyYAML, PyJWT
