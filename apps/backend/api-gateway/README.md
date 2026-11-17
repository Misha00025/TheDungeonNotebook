# API Gateway

Сборка из корня репозитория:

```bash
make build-api-gateway
```

Локальный endpoint: http://localhost:5000

[Публичная HTML-документация](../../../docs/api/index.html)

Gateway validates tokens through Account Service and the external provider configured there.

## Campaign Service routes

Campaign Service routes are forwarded one-to-one under `/api/campaigns/...`; the upstream path is identical to the external path. Protected routes use the existing Account Service authentication and forward only the verified `X-Subject`. Gateway does not inject `userId` or rewrite request bodies and does not wrap campaign responses. The active methods are defined in [`configs/routes.yaml`](configs/routes.yaml); see the Campaign Service [Gateway routing contract](../campaign-service/docs/gateway.md) and [contribution rules](../campaign-service/CONTRIBUTING.md).

**Внимание:** root-команда `make test` очищает тестовые данные баз данных перед запуском интеграционных тестов.
