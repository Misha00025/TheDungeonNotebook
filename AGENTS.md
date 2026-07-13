# The Dungeon Notebook — Agent Overview

## Project Type
Monorepo with microservice architecture: API Gateway + 4 C# backend services + Admin Panel (planned).

## Languages & Runtimes
- Python 3.13 (api-gateway, admin-panel)
- C# .NET 8 (auth-service, users-service, campaign-service, uploads-service)
- Docker Compose (orchestration)

## Service Map

| Service | Lang | Port | DB | Responsibility |
|---------|------|------|----|----------------|
| api-gateway | Python/Flask | 5000 | — | Entry point. Declarative YAML routing. JWT validation. Proxy to backends. |
| auth-service | C# .NET 8 | 8080 | MySQL | Registration, login, JWT (RSA-256), refresh tokens, service tokens |
| users-service | C# .NET 8 | 8080 | MySQL | User profile CRUD |
| campaign-service | C# .NET 8 | 8080 | MySQL + MongoDB | Groups, characters, items, skills, notes, schemas, policies |
| uploads-service | C# .NET 8 | 8080 | Filesystem | File/image uploads (multipart, 10MB max) |
| admin-panel | Python/Flask | 8081 | — | Admin CRUD UI (Jinja2, not yet built) |

notes-service is **deprecated** — its logic is merged into campaign-service.

## Quick Start
```bash
cd backend
# Create .env from template.env, place RSA keys in certs/
docker compose up -d
```

## Databases
- MySQL 8.0 — shared instance, separate databases for auth, users, campaign
- MongoDB — campaign schemas and notes

## Order of startup (managed by depends_on)
1. MySQL + MongoDB
2. auth-service, users-service, campaign-service
3. api-gateway
4. uploads-service runs separately

## Gateway действий для агентов

Прежде чем выполнять действие, прочитай соответствующий rule-файл. Не угадывай.

| Действие | Читать |
|----------|--------|
| Запустить тесты | `rules/tech-testing.md` |
| Собрать / запустить docker-compose | `rules/tech-docker.md` |
| Изменить Python-сервис | `rules/tech-python.md` + `<service>/rules.md` |
| Изменить C# сервис | `rules/tech-csharp.md` + `<service>/rules.md` |
| Изменить api-gateway | `backend/api-gateway/rules.md` |
| Изменить auth-service | `backend/auth-service/rules.md` |
| Изменить users-service | `backend/users-service/rules.md` |
| Изменить campaign-service | `backend/campaign-service/rules.md` |
| Изменить uploads-service | `backend/uploads-service/rules.md` |
| Просмотреть / актуализировать документацию API | `rules/service-docs.md` |
| Настроить мониторинг | `rules/service-monitoring.md` |
| Что-то с админ-панелью | `admin/rules.md` |

## Rule Files Reference

### General (`rules/`)
- `tech-python.md` — Flask/Gunicorn conventions
- `tech-csharp.md` — .NET 8 project layout, EF Core, BaseController
- `tech-docker.md` — Dockerfile, docker-compose, env vars, certs, networks
- `tech-testing.md` — Integration test framework (Python), scenarios, test.sh
- `service-docs.md` — Static API docs (data.js, HTML, JSON schemas)
- `service-monitoring.md` — Prometheus + Grafana config

### Per-Service (`<service>/rules.md`)
- `backend/api-gateway/rules.md` — Declarative engine, routes.yaml, pipeline, handlers
- `backend/auth-service/rules.md` — RSA JWT, BCrypt, token endpoints
- `backend/users-service/rules.md` — User profile CRUD
- `backend/campaign-service/rules.md` — Groups, characters, items, skills, notes, schemas, policies
- `backend/uploads-service/rules.md` — File uploads, MIME, multipart, Sources/ structure
- `admin/rules.md` — Admin panel plan overview (see PLAN.md)
