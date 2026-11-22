# API Gateway

Сборка из корня репозитория:

```bash
make build-api-gateway
```

Локальный endpoint: http://localhost:5000

[Публичная HTML-документация](../../../docs/api/index.html)

Gateway validates tokens through Account Service and the external provider configured there.

## Campaign Service routes

Campaign Service routes are forwarded one-to-one under `/api/campaigns/...`; the upstream path is identical to the external path. Protected routes use the existing Account Service authentication and forward only the verified `X-Subject`. This includes `GET /api/campaigns/{campaignId}/permissions` and `GET /api/campaigns/{campaignId}/characters/{characterId}/permissions`; neither has parameter injection. Gateway does not inject `userId` or rewrite request bodies and does not wrap campaign responses. The active methods are defined in [`configs/routes.yaml`](configs/routes.yaml); see the Campaign Service [Gateway routing contract](../campaign-service/docs/gateway.md), [permissions contract](../campaign-service/docs/permissions.md), and [contribution rules](../campaign-service/CONTRIBUTING.md).

The template proxy exposes only GET/PUT on `/api/campaigns/{campaignId}/template`, `/template/content`, and `/template/virtual-fields`. Plural template catalog/create routes and template-GUID routes are not active. Gateway/BFF transport and verified `X-Subject` forwarding are unchanged; see the [singleton-template Web handoff](../campaign-service/docs/singleton-template-web.md) for client contract changes.

The shared item/skill catalog routes are described in the campaign-service [catalog contract](../campaign-service/docs/catalog.md).

Character-attached catalog entries, add receipts, quantities, and local attributes use explicit routes under `/api/campaigns/{campaignId}/characters/{characterId}/entries`; see the campaign-service [character catalog contract](../campaign-service/docs/character-catalog.md). These routes forward the verified `X-Subject` one-to-one and do not add policy hooks or parameter injection.

Campaign catalog group routes are `GET|PUT /api/campaigns/{campaignId}/catalog/groups`, `GET /api/campaigns/{campaignId}/catalog/groups/configuration`, and `GET /api/campaigns/{campaignId}/catalog/groups/{groupId}/entries`. See the campaign-service [catalog groups contract](../campaign-service/docs/catalog-groups.md). They use the existing verified-subject hooks without group-specific access rules or parameter injection.

Virtual-field requests use ordinary `bindings` only; separate parent-field properties are not part of the service contract. Existing template/custom virtual-field and override routes pass bodies through without rewrites.

**Внимание:** root-команда `make test` очищает тестовые данные баз данных перед запуском интеграционных тестов.
