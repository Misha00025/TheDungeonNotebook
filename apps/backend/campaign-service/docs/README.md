# Campaign Service API

Current API contracts:

- [Campaigns and membership](campaigns.md)
- [Templates and base-field definitions](templates.md)
- [Characters, assignments, and sheets](characters.md)
- [Formulas, virtual fields, and computed sheets](formulas.md)
- [Views and presentation contexts](views.md)

Routes in the [legacy public HTML API documentation](../../../../docs/api/index.html) are historical and are not served by this host.

Run the service from its root directory (`apps/backend/campaign-service`):

```sh
dotnet run --project CampaignService.csproj --no-launch-profile --urls http://localhost:5100
```

Configure `ConnectionStrings:MySql` before starting. Database migrations are not applied automatically unless `Database:ApplyMigrations` is set to `true`.
