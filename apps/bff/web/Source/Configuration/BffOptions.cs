using Microsoft.Extensions.Options;

namespace Tdn.Bff.Configuration;

public sealed class BffOptions
{
    public const string SectionName = "Bff";

    public EndpointsOptions Endpoints { get; set; } = new();
    public LogoutOptions Logout { get; set; } = new();
    public RedisOptions Redis { get; set; } = new();
    public SessionOptions Session { get; set; } = new();
    public TransportOptions Transport { get; set; } = new();
    public WebOptions Web { get; set; } = new();
    public DataProtectionOptions DataProtection { get; set; } = new();
    public ClientAuthentication ClientAuthentication { get; set; } = ClientAuthentication.PostBody;
}

public sealed class EndpointsOptions
{
    public string Login { get; set; } = "/bff/login";
    public string Session { get; set; } = "/bff/session";
    public string Logout { get; set; } = "/bff/logout";
    public string LogoutContinuation { get; set; } = "/bff/logout/continue";
}

public sealed class LogoutOptions
{
    public TimeSpan RequestLifetime { get; set; } = TimeSpan.FromMinutes(5);
}

public sealed class RedisOptions
{
    public string ConnectionString { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = "tdn:bff:";
}

public sealed class SessionOptions
{
    public TimeSpan Lifetime { get; set; } = TimeSpan.FromHours(8);
    public TimeSpan RefreshBeforeExpiry { get; set; } = TimeSpan.FromSeconds(30);
    public TimeSpan AccessTokenLifetimeWhenMissing { get; set; } = TimeSpan.FromMinutes(5);
    public TimeSpan LockWaitTimeout { get; set; } = TimeSpan.FromSeconds(10);
    public TimeSpan LockExpiry { get; set; } = TimeSpan.FromSeconds(30);
    public TimeSpan LockExtensionCadence { get; set; } = TimeSpan.FromSeconds(5);
}

public sealed class TransportOptions
{
    public List<string> RequestHeaders { get; set; } = [];
    public List<string> ResponseHeaders { get; set; } = [];
}

public sealed class WebOptions
{
    public string? PublicOrigin { get; set; }
    public List<string> AllowedOrigins { get; set; } = [];
}

public sealed class DataProtectionOptions
{
    public string ApplicationName { get; set; } = "Tdn.Bff";
    public string? KeyDirectory { get; set; }
}

public enum ClientAuthentication
{
    PostBody,
    Basic,
    None
}

public sealed class BffOptionsValidator : IValidateOptions<BffOptions>
{
    public ValidateOptionsResult Validate(string? name, BffOptions options)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(options.Redis.ConnectionString))
            errors.Add("Bff:Redis:ConnectionString is required.");
        if (string.IsNullOrWhiteSpace(options.Redis.KeyPrefix))
            errors.Add("Bff:Redis:KeyPrefix is required.");
        if (string.IsNullOrWhiteSpace(options.DataProtection.ApplicationName))
            errors.Add("Bff:DataProtection:ApplicationName is required.");
        ValidatePositive(options.Session.Lifetime, "Bff:Session:Lifetime", errors);
        ValidateNonNegative(options.Session.RefreshBeforeExpiry, "Bff:Session:RefreshBeforeExpiry", errors);
        ValidatePositive(options.Session.AccessTokenLifetimeWhenMissing, "Bff:Session:AccessTokenLifetimeWhenMissing", errors);
        ValidatePositive(options.Session.LockWaitTimeout, "Bff:Session:LockWaitTimeout", errors);
        ValidatePositive(options.Session.LockExpiry, "Bff:Session:LockExpiry", errors);
        ValidatePositive(options.Session.LockExtensionCadence, "Bff:Session:LockExtensionCadence", errors);
        if (options.Session.LockExtensionCadence >= options.Session.LockExpiry)
            errors.Add("Bff:Session:LockExtensionCadence must be less than Bff:Session:LockExpiry.");

        ValidateLocalPath(options.Endpoints.Login, "Bff:Endpoints:Login", errors);
        ValidateLocalPath(options.Endpoints.Session, "Bff:Endpoints:Session", errors);
        ValidateLocalPath(options.Endpoints.Logout, "Bff:Endpoints:Logout", errors);
        ValidateLocalPath(options.Endpoints.LogoutContinuation, "Bff:Endpoints:LogoutContinuation", errors);
        ValidatePositive(options.Logout.RequestLifetime, "Bff:Logout:RequestLifetime", errors);

        ValidateOrigin(options.Web.PublicOrigin, "Bff:Web:PublicOrigin", errors);
        foreach (var origin in options.Web.AllowedOrigins)
            ValidateOrigin(origin, "Bff:Web:AllowedOrigins", errors);

        return errors.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(errors);
    }

    private static void ValidatePositive(TimeSpan value, string name, ICollection<string> errors)
    {
        if (value <= TimeSpan.Zero)
            errors.Add($"{name} must be positive.");
    }

    private static void ValidateNonNegative(TimeSpan value, string name, ICollection<string> errors)
    {
        if (value < TimeSpan.Zero)
            errors.Add($"{name} must not be negative.");
    }

    private static void ValidateLocalPath(string? value, string name, ICollection<string> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            errors.Add($"{name} must be a non-empty local path.");
            return;
        }

        if (!value.StartsWith('/') || value.StartsWith("//", StringComparison.Ordinal) || value.Contains('?') || value.Contains('#'))
            errors.Add($"{name} must be a non-empty local path.");
    }

    private static void ValidateOrigin(string? value, string name, ICollection<string> errors)
    {
        if (value is null && name.EndsWith("PublicOrigin", StringComparison.Ordinal))
            return;

        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) ||
            string.IsNullOrEmpty(uri.Host) || !string.IsNullOrEmpty(uri.UserInfo) ||
            !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment) || value.Contains('?') || value.Contains('#') ||
            (uri.AbsolutePath != "/" && uri.AbsolutePath.Length != 0) || value.Contains('*'))
            errors.Add($"{name} must be an absolute HTTP or HTTPS origin without credentials, query, fragment, or path.");
    }
}
