# The Dungeon Notebook

Лучшая записная книжка любителя подземелий и других приключенческих штук :)

## Архитектура

API Gateway (Flask, порт 5000) — единая точка входа. Проксирует запросы к микросервисам:

- **api-gateway** (Python/Flask) — [README](backend/api-gateway/README.md)
- **auth-service** (C# .NET 8) — [README](backend/auth-service/README.md)
- **users-service** (C# .NET 8) — [README](backend/users-service/README.md)
- **campaign-service** (C# .NET 8) — [README](backend/campaign-service/README.md)
- **notes-service** (C# .NET 8) — [README](backend/notes-service/README.md)
- **uploads-service** (C# .NET 8) — [README](backend/uploads-service/README.md)

### Базы данных

- **MySQL 8.0** — auth-service, users-service, campaign-service
- **MongoDB** — campaign-service, notes-service

## Переменные окружения (.env)

| Переменная | Описание |
|---|---|
| `MONGO_INITDB_ROOT_USERNAME` | Пользователь MongoDB |
| `MONGO_INITDB_ROOT_PASSWORD` | Пароль MongoDB |
| `MYSQL_ROOT_PASSWORD` | Root-пароль MySQL |
| `MYSQL_DATABASE` | Имя базы данных MySQL |
| `MYSQL_USER` | Пользователь MySQL |
| `MYSQL_PASSWORD` | Пароль MySQL |
| `SERVICE_TOKEN` | Сервисный токен |

Также требуются RSA-ключи в `backend/certs/private.pem` и `backend/certs/public.pem`.

## Настройка и запуск (Docker)

```bash
cd backend

# Создать .env на основе шаблона
# Поместить RSA-ключи в ./certs/private.pem и ./certs/public.pem

docker compose up -d
```

После запуска:
- API Gateway доступен на `http://localhost:5000`
- Metrics (Prometheus) доступны на `/metrics` у каждого сервиса

Порядок запуска (docker-compose управляет автоматически через depends_on):
1. MySQL + MongoDB
2. auth-service, users-service, campaign-service, notes-service
3. api-gateway

### Запуск uploads-service (отдельно)

```bash
cd backend/uploads-service
docker compose up -d
```

## Мониторинг

Prometheus + Grafana — `cd monitoring && docker compose up -d`
