# Campaign Service API

The current campaigns and membership contract is documented in [Campaigns API](campaigns.md). Routes in the [legacy public HTML API documentation](../../../../docs/api/index.html) are historical and are not served by this host.

Run the service from its root directory (`apps/backend/campaign-service`):

```sh
dotnet run --project CampaignService.csproj --no-launch-profile --urls http://localhost:5100
```

Configure `ConnectionStrings:MySql` before starting. Database migrations are not applied automatically unless `Database:ApplyMigrations` is set to `true`.
