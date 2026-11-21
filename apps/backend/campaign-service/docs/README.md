# Campaign Service API

Current API contracts:

- [Campaigns and membership](campaigns.md)
- [Current resource permissions](permissions.md)
- [Templates and base-field definitions](templates.md)
- [Characters, assignments, and sheets](characters.md)
- [Formulas, virtual fields, and computed sheets](formulas.md)
- [Views and presentation contexts](views.md)
- [Catalog entries, attribute schemas, and content](catalog.md)
- [API Gateway routing](gateway.md)
- [Singleton-template Web handoff](singleton-template-web.md)

Routes in the [legacy public HTML API documentation](../../../../docs/api/index.html) are historical and are not served by this host.

Run the service from its root directory (`apps/backend/campaign-service`):

```sh
dotnet run --project CampaignService.csproj --no-launch-profile --urls http://localhost:5100
```

Configure `MYSQL_CONNECTION_STRING`, `MONGO_CONNECTION_STRING`, and `MONGO_DATABASE` before starting. Pending database migrations are applied automatically on host startup by default; set `Database:ApplyMigrations` to `false` to disable them.
