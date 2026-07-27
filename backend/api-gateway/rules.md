# api-gateway Service Rules

## Project Structure
```
api-gateway/
├── configs/
│   └── routes.yaml               # ~67 declarative endpoints (корень сервиса)
├── handlers/                     # Кастомные хендлеры
│   ├── __init__.py               # Явный импорт access + responses
│   ├── access.py                 # @register_access_handler("group_member"), etc.
│   └── responses.py              # @register_response_handler("handler_name") — async
├── main.py                       # Uvicorn entrypoint (import handlers, create_app())
└── tests/                        # Integration tests (см. rules/tech-testing.md)
```

## Overview
API Gateway теперь основан на **PyApiGate** — внешнем FastAPI-сервисе (образ `ghcr.io/misha00025/pyapi-gate:latest`).
Движок и вся инфраструктура живут в образе. В этом репозитории — только кастомный код:
- `configs/routes.yaml` — декларативная конфигурация маршрутов
- `handlers/` — кастомные access и response хендлеры
- `main.py` — точка входа для uvicorn

## Declarative Engine
- **Все новые маршруты — в `configs/routes.yaml`**
- Pipeline на маршрут: `auth → access → proxy` (или `response` для кастомных хендлеров)
- `base_url` сервисов поддерживает подстановку `${ENV_VAR}` и `${ENV_VAR:-default}`
- URL-паттерны: `{group_id}` (FastAPI-style), а не `<int:group_id>` (Flask-style)

## RouteConfig fields (in routes.yaml)
```yaml
routes:
  - path: "/groups/{group_id}"
    methods: ["GET"]
    proxy:
      service: campaign
      path: /groups/{group_id}
    auth: required
    access: group_member
```

## Handler Registries
```python
from app.engine.registry import (
    register_access_handler,
    register_response_handler,
)

@register_access_handler("group_admin")
def check_group_admin(ctx: RouteContext) -> AccessResult: ...

@register_response_handler("get_api")
async def handle_get_api(ctx: RouteContext) -> Response: ...
```

> **Примечание:** `app.` импорты внутри хендлеров (`from app.engine.context`) работают, т.к. образ содержит PyApiGate в `sys.path`.

## RouteContext
```python
ctx.request      # FastAPI Request (не Flask!)
ctx.jwt          # Decoded JWT payload (dict) or None
ctx.path_params  # URL path params {group_id: "123"}
ctx.services     # ServiceRegistry instance
ctx.services.campaign.get("/groups/1")
ctx.services.campaign.post("/groups", json={...})
```

## ServiceRegistry
```python
ctx.services.auth     # http://auth-service:8080
ctx.services.users    # http://users-service:8080
ctx.services.campaign # http://campaign-service:8080
```

## Security
- JWT validation — **OAuth2 JWT via JWKS endpoint** (`oauth2_jwt` strategy)
- JWKS fetched from `AUTH_SERVICE_URL/.well-known/jwks.json`
- Issuer validation via `OIDC_ISSUER` env var
- CORS настраивается в переменных окружения gateway

## Key Differences from Old Flask Gateway
| Old (Flask) | New (FastAPI/PyApiGate) |
|---|---|
| `<int:group_id>` в URL | `{group_id}` в URL |
| `ctx.request.args` | `ctx.request.query_params` |
| `ctx.request.get_json()` | `await ctx.request.json()` (response handlers) |
| `from app.status import ok` | `from app.engine.status import ok` |
| Access handlers — любые | Access handlers — **синхронные** |
| Response handlers — синхронные | Response handlers — **async** |
| `build: context: ./api-gateway` | `image: ghcr.io/misha00025/pyapi-gate:latest` |
| Свой `app/` (engine, security) | Engine в образе, только кастомный код в `handlers/` |

## Dependencies
PyApiGate (внешний образ) — FastAPI, uvicorn, PyJWT, httptools, requests, PyYAML, starlette
