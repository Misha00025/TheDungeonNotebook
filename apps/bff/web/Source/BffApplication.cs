using Tdn.Bff.Configuration;
using Tdn.Bff.Endpoints;
using Tdn.Bff.Errors;
using Tdn.Bff.Upstream;

namespace Tdn.Bff;

public static class BffApplication
{
    public static WebApplication Build(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.Configuration
            .AddJsonFile("config/appsettings.json", optional: true, reloadOnChange: true)
            .AddJsonFile($"config/appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
            .AddEnvironmentVariables();
        if (args.Length > 0)
            builder.Configuration.AddCommandLine(args);

        builder.Services.AddBffServices(builder.Configuration);

        var app = builder.Build();
        app.UseForwardedHeaders();
        app.UseMiddleware<BffExceptionMiddleware>();
        app.UseRouting();
        app.UseCors();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapBffEndpoints();
        app.MapReverseProxy(proxyPipeline => proxyPipeline.UseMiddleware<GatewaySessionMiddleware>())
            .RequireAuthorization();
        return app;
    }
}
