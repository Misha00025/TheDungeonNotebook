using Microsoft.EntityFrameworkCore;
using Tdn.Accounts.Configuration;
using Tdn.Accounts.Persistence;
using Tdn.Accounts.Security;

var builder = WebApplication.CreateBuilder(args);
var configPath = Environment.GetEnvironmentVariable("ACCOUNT_CONFIG");
if (!string.IsNullOrWhiteSpace(configPath)) builder.Configuration.AddJsonFile(configPath, optional: false, reloadOnChange: false).AddEnvironmentVariables();
var connection = Environment.GetEnvironmentVariable("MYSQL_CONNECTION_STRING") ?? throw new InvalidOperationException("MYSQL_CONNECTION_STRING is required");
builder.Services.Configure<InternalAuthOptions>(builder.Configuration.GetSection("InternalAuth"));
builder.Services.Configure<AccountOptions>(builder.Configuration.GetSection("Accounts"));
builder.Services.Configure<OidcOptions>(builder.Configuration.GetSection("Oidc"));
builder.Services.Configure<LegacyGroupsOptions>(builder.Configuration.GetSection("LegacyGroups"));
builder.Services.AddSingleton(sp => sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<LegacyGroupsOptions>>().Value);
builder.Services.AddSingleton(sp =>
{
    var legacy = sp.GetRequiredService<LegacyGroupsOptions>();
    legacy.Validate(sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<OidcOptions>>().Value);
    return new LegacyGroupTokenValidator(legacy);
});
builder.Services.AddSingleton(sp => new InternalServiceKey(sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<InternalAuthOptions>>().Value.ResolveKey()));
builder.Services.AddDbContext<AccountsDbContext>(o => o.UseMySql(connection, new MySqlServerVersion(new Version(8, 0, 0))));
builder.Services.AddScoped<IAccountStore, AccountStore>();
builder.Services.AddScoped<OidcTokenValidator>(sp => new(sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<OidcOptions>>().Value, sp.GetRequiredService<IHttpClientFactory>()));
builder.Services.AddScoped<AuthenticationService>();
builder.Services.AddHttpClient("oidc", (sp, client) => { client.Timeout = TimeSpan.FromSeconds(sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<OidcOptions>>().Value.TimeoutSeconds); client.MaxResponseContentBufferSize = 1024 * 1024; })
    .ConfigurePrimaryHttpMessageHandler(sp => new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false });
builder.Services.AddHostedService<AccountConfigurationValidator>();
builder.Services.AddHostedService<AccountInitializer>();
builder.Services.AddControllers();
builder.Services.AddHealthChecks();
var app = builder.Build();
app.MapGet("/health/live", () => Results.Ok(new { status = "live" }));
app.MapGet("/health/ready", async (AccountsDbContext db, CancellationToken ct) =>
{
    try { return await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503); }
    catch { return Results.StatusCode(503); }
});
app.MapControllers();
app.Run();
public partial class Program { }
