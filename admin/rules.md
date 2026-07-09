# admin-panel Rules

## Status
**Not yet built** — see `PLAN.md` for full technical specification.

## Architecture
- Flask + Jinja2 web application
- Runs on port 8081
- Connects to `backend_backend-network` (external: true) — same network as backend
- Accesses services directly via hostname: `auth-service`, `users-service`, `campaign-service`

## Project Structure
```
admin/
├── PLAN.md              # Full TZ (1753 lines) — primary reference
├── docker-compose.yaml  # (not yet created)
├── Dockerfile           # python:3.13, Flask, Gunicorn
├── app/
│   ├── __init__.py
│   ├── routes/          # Flask blueprints
│   ├── static/          # CSS, JS
│   └── templates/       # Jinja2 templates
└── req.txt
```

## Network
- Uses external network `backend_backend-network` (created by backend stack)
- `external: true` in docker-compose.yaml

## Authentication
- Uses service JWT tokens to authenticate against the backend
- Admin credentials not yet specified — TBD in implementation

## Reference
For implementation details, patterns, and conventions, see `admin/PLAN.md` — it contains the complete architecture, endpoint list, UI layout, and data flow diagrams.
