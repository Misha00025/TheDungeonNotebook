# The Dungeon Notebook — Agent Overview

## Project Type
Monorepo with microservice architecture: API Gateway + 4 C# backend services + sync-service (Python) + Admin Panel.

## Languages & Runtimes
- Python 3.13 (api-gateway, admin-panel, sync-service)
- C# .NET 8 (auth-service, users-service, campaign-service, game-systems-service)
- Docker Compose (orchestration)

## Service Map

| Service | Lang | Port | DB | Responsibility |
|---------|------|------|----|----------------|
| api-gateway | Python/FastAPI (PyApiGate) | 5000 | — | Entry point. Declarative YAML routing. JWT validation. Proxy to backends. |
| auth-service | C# .NET 8 | 8080 | MySQL | Registration, login, JWT (RSA-256), refresh tokens, service tokens |
| users-service | C# .NET 8 | 8080 | MySQL + MongoDB | User profile CRUD + per-user settings (MongoDB) |
| campaign-service | C# .NET 8 | 8080 | MySQL + MongoDB | Groups, characters, items, skills, notes, schemas, policies |
| game-systems-service | C# .NET 8 | 8080 | MySQL + MongoDB | Game systems, versions, snapshots, content (items/skills/template) |
| sync-service | Python/FastAPI | 8090 | — | Orchestrator between game-systems and campaign (async sync) |

| admin-panel | Python/Flask | 8081 | — | Admin CRUD UI (Jinja2) |

## Quick Start
```bash
cd backend
# Create .env from template.env, place RSA keys in certs/
docker compose up -d
```

## Databases
- MySQL 8.0 — shared instance, separate databases for auth, users, campaign, game-systems
- MongoDB — campaign schemas and notes, users settings, game-systems snapshots
- Redis — cache (auth-service depends on it)

## Order of startup (managed by depends_on)
1. MySQL + MongoDB + Redis
2. auth-service, users-service, campaign-service, game-systems-service
3. sync-service
4. api-gateway

## Процессные правила (из опыта работы над проектом)

1. **Не откатывать** — искать решение вперёд, не "как было", а "как должно быть"
2. **Параллельность — только по смыслу** — независимые задачи можно, зависимые — последовательно
3. **Архитектура не жертвуется тестам** — тесты в сервисах (C#) переделываем под новую архитектуру. Сквозные тесты (api-gateway) не правим без утверждения пользователем. Если падение сквозного теста — явная ошибка сервиса (500 вместо 200) — чиним сервис. Если поведение изменилось намеренно и тест устарел — это триггер для п.4.
4. **Неясная проблема — консилиум** — при намеренном расхождении сквозного теста (п.3) запустить 2-3 Plan-агента с полярными позициями: один отстаивает тест, другой — сервис. С результатами — к пользователю.
5. **Сквозные тесты** — `backend/tests/test.sh` (python, не dotnet)

## Gateway действий для агентов

Прежде чем выполнять действие, прочитай соответствующий rule-файл. Не угадывай.

| Действие | Читать |
|----------|--------|
| Запланировать крупное изменение | `rules/tech-planning.md` |
| Запустить тесты | `rules/tech-testing.md` |
| Собрать / запустить docker-compose | `rules/tech-docker.md` |
| Изменить Python-сервис | `rules/tech-python.md` + `<service>/rules.md` |
| Изменить C# сервис | `rules/tech-csharp.md` + `<service>/rules.md` |
| Изменить api-gateway | `backend/api-gateway/rules.md` |
| Изменить auth-service | `backend/auth-service/rules.md` |
| Изменить users-service | `backend/users-service/rules.md` |
| Изменить campaign-service | `backend/campaign-service/rules.md` |
| Изменить game-systems-service | `backend/game-systems-service/rules.md` |
| Изменить sync-service | `backend/sync-service/README.md` |

| Просмотреть / актуализировать документацию API | `rules/service-docs.md` |
| Настроить мониторинг | `rules/service-monitoring.md` |
| Что-то с админ-панелью | `admin/rules.md` |

## Rule Files Reference

### General (`rules/`)
- `tech-python.md` — FastAPI/Uvicorn conventions
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
- `backend/game-systems-service/rules.md` — Game systems, versions, snapshots, content
- `backend/sync-service/README.md` — Sync orchestrator between game-systems and campaign

- `admin/rules.md` — Admin panel plan overview (see PLAN.md)
