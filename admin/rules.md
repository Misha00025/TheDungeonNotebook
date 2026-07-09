# admin-panel Rules

## Status
**Built** — see `PLAN.md` for task list.

## Task tracking (PLAN.md)
- Completed tasks are marked with ✓ in the task table.
- New feature ideas go into **Раздел 2. Следующие задачи** as a new row.
- Ideas that cannot be implemented without backend changes go into `GAPS.md`.
- Never rewrite or restructure the task table — only append or tick.

## Architecture
- Flask + Jinja2 web application
- Runs on port 8081
- Connects to `backend_backend-network` (external: true) — same network as backend
- Accesses services directly via hostname: `auth-service`, `users-service`, `campaign-service`

## Project Structure
```
admin/
├── PLAN.md              # Task list (✓ = done)
├── GAPS.md              # Features blocked by missing backend endpoints
├── docker-compose.yaml
├── Dockerfile           # python:3.13, Flask, Gunicorn
├── requirements.txt
├── .env.example
├── app/
│   ├── __init__.py      # create_app()
│   ├── config.py        # Config from env
│   ├── middleware.py    # JWT auth, @login_required
│   ├── services.py     # HTTP clients to all services
│   └── routes/
│       ├── auth.py      # /admin/login, /admin/logout
│       ├── dashboard.py # /admin/
│       ├── users.py     # /admin/users, /admin/users/<id>, /admin/users/create
│       ├── groups.py    # /admin/groups, /admin/groups/<id>, /admin/groups/create
│       ├── content.py   # /admin/content
│       └── bots.py      # /admin/bots — service tokens
├── templates/           # Jinja2 templates
└── static/
    └── style.css
```

## Network
- Uses external network `backend_backend-network` (created by backend stack)
- `external: true` in docker-compose.yaml

## Authentication
- Admin login via `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`
- HS256 JWT stored in httpOnly cookie `admin_token`, 24h expiry (separate from app's RS256 JWT)
- `@login_required` decorator on all blueprint routes except `auth`

## Reference
- `PLAN.md` — task list
- `GAPS.md` — missing backend endpoints
