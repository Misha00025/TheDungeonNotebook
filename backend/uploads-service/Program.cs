using Microsoft.AspNetCore.HttpOverrides;
using Prometheus;
using Tdn.UploadService.Services;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.File("/logs/uploads-service-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// General
builder.Services.AddMvc();
builder.Services.AddHttpContextAccessor();


builder.Services.AddHttpClient<IAuthService, AuthService>(client =>
{
    var authServiceUrl = builder.Configuration["AUTH_SERVICE_URL"] 
        ?? throw new ArgumentNullException("AUTH_SERVICE_URL environment variable is required");
    client.BaseAddress = new Uri(authServiceUrl);
    client.Timeout = TimeSpan.FromSeconds(30);
});
builder.Services.Configure<IISServerOptions>(options =>
{
    options.MaxRequestBodySize = 10 * 1024 * 1024; // 10MB
});

// General
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddControllers();


builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    options.ForwardLimit = null;
});

var app = builder.Build();
app.UseForwardedHeaders();
app.UseAuthorization();
app.UseStaticFiles();
app.UseHttpMetrics();
app.MapMetrics();
app.MapControllers();

var webRootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
if (!Directory.Exists(webRootPath))
{
    Directory.CreateDirectory(webRootPath);
}

app.Run();

