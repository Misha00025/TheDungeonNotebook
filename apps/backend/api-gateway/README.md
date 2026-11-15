# API Gateway

Сборка из корня репозитория:

```bash
make build-api-gateway
```

Локальный endpoint: http://localhost:5000

[Публичная HTML-документация](../../../docs/api/index.html)

Gateway validates tokens through Account Service and the external provider configured there.

**Внимание:** root-команда `make test` очищает тестовые данные баз данных перед запуском интеграционных тестов.
