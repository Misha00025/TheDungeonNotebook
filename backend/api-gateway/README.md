# API Gateway

Сборка из корня репозитория:

```bash
make build-api-gateway
```

Локальный endpoint: http://localhost:5000

[Публичная HTML-документация](../../docs/api/index.html)

Для настройки окружения используются переменные `AUTH_SERVICE_URL`, `USERS_SERVICE_URL`, `CAMPAIGN_SERVICE_URL`, `GAME_SYSTEMS_SERVICE_URL`, `SYNC_SERVICE_URL`, `PUBLIC_KEY_PATH`, `OIDC_ISSUER` и `APP_CONFIG`.

**Внимание:** root-команда `make test` очищает тестовые данные баз данных перед запуском интеграционных тестов.
