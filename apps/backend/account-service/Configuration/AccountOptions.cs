namespace Tdn.Accounts.Configuration;

public sealed record InternalServiceKey(string Value);

public sealed class LegacyGroupsOptions
{
    public bool Enabled { get; set; }
    public string? Issuer { get; set; }
    public string? Audience { get; set; }
    public string? PublicKeyPath { get; set; }
    public int ClockSkewSeconds { get; set; }
    public void Validate(OidcOptions oidc)
    {
        if (!Enabled) return;
        if (string.IsNullOrWhiteSpace(Issuer) || Issuer.Length > 512 || string.IsNullOrWhiteSpace(Audience) || string.IsNullOrWhiteSpace(PublicKeyPath) || ClockSkewSeconds is < 0 or > 300)
            throw new InvalidOperationException("Invalid LegacyGroups configuration");
        if (oidc.Providers.Any(p => StringComparer.Ordinal.Equals(p.Issuer, Issuer))) throw new InvalidOperationException("LegacyGroups.Issuer must not match an OIDC issuer");
    }
}

public sealed class AccountOptions
{
    public int FirstAccountId { get; set; } = 1;
}

public sealed class InternalAuthOptions
{
    public string? ApiKey { get; set; }
    public string? ApiKeyFile { get; set; }
    public string ResolveKey()
    {
        var direct = string.IsNullOrWhiteSpace(ApiKey) ? null : ApiKey;
        var file = string.IsNullOrWhiteSpace(ApiKeyFile) ? null : ApiKeyFile;
        if (direct is not null && file is not null) throw new InvalidOperationException("Configure only one InternalAuth API key source");
        var key = direct ?? (file is null ? null : File.ReadAllText(file).TrimEnd('\r', '\n'));
        if (string.IsNullOrEmpty(key) || System.Text.Encoding.UTF8.GetByteCount(key) < 32)
            throw new InvalidOperationException("InternalAuth API key must be at least 32 bytes");
        return key;
    }
}

public sealed class OidcOptions
{
    public int TimeoutSeconds { get; set; } = 10;
    public List<OidcProviderOptions> Providers { get; set; } = [];
    public void Validate()
    {
        if (TimeoutSeconds is < 1 or > 60 || Providers is null || Providers.Count == 0) throw new InvalidOperationException("Invalid OIDC configuration");
        if (Providers.Any(p => p.Issuer.Length > 512 || string.IsNullOrWhiteSpace(p.Issuer))) throw new InvalidOperationException("Invalid OIDC issuer");
        if (Providers.Select(p => p.Issuer).Distinct(StringComparer.Ordinal).Count() != Providers.Count) throw new InvalidOperationException("OIDC issuers must be unique");
        foreach (var p in Providers)
        {
            p.NormalizeOptionalValues();
            p.Validate();
        }
    }
}

public sealed class OidcProviderOptions
{
    public string Issuer { get; set; } = "";
    public string? MetadataAddress { get; set; }
    public string? JwksUri { get; set; }
    public List<string> Audiences { get; set; } = [];
    public List<string> AllowedAlgorithms { get; set; } = [];
    public List<string> ValidHeaderTypes { get; set; } = [];
    public string? AccessTokenTypeClaim { get; set; }
    public List<string> AccessTokenTypeValues { get; set; } = [];
    public List<string> RequiredScopes { get; set; } = [];
    public int ClockSkewSeconds { get; set; }
    public bool AllowHttpForDevelopment { get; set; }
    public Uri MetadataUri => new(MetadataAddress ?? Issuer.TrimEnd('/') + "/.well-known/openid-configuration");
    public void NormalizeOptionalValues()
    {
        if (AllowedAlgorithms is null || AllowedAlgorithms.Count == 0) AllowedAlgorithms = ["RS256"];
        if (ValidHeaderTypes is null || ValidHeaderTypes.Count == 0) ValidHeaderTypes = ["at+jwt", "application/at+jwt"];
        if (string.IsNullOrWhiteSpace(MetadataAddress)) MetadataAddress = null;
        if (string.IsNullOrWhiteSpace(JwksUri)) JwksUri = null;
        if (string.IsNullOrWhiteSpace(AccessTokenTypeClaim)) AccessTokenTypeClaim = null;
        RequiredScopes = RequiredScopes.Where(s => !string.IsNullOrWhiteSpace(s)).ToList();
    }
    public void Validate()
    {
        NormalizeOptionalValues();
        if (!Uri.TryCreate(Issuer, UriKind.Absolute, out var issuer) || !Uri.TryCreate(MetadataUri.ToString(), UriKind.Absolute, out _)
            || Audiences is null || Audiences.Count == 0 || Audiences.Any(string.IsNullOrWhiteSpace) || ValidHeaderTypes is null || ValidHeaderTypes.Count == 0 || ValidHeaderTypes.Any(string.IsNullOrWhiteSpace) || ClockSkewSeconds is < 0 or > 300) throw new InvalidOperationException("Invalid OIDC provider configuration");
        EnsureUri(issuer);
        EnsureUri(MetadataUri);
        if (JwksUri is not null) EnsureUri(new Uri(JwksUri));
        var algorithms = new HashSet<string>(["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512"], StringComparer.Ordinal);
        if (AllowedAlgorithms is null || AllowedAlgorithms.Count == 0 || AllowedAlgorithms.Any(a => !algorithms.Contains(a))) throw new InvalidOperationException("Only supported asymmetric OIDC algorithms are allowed");
        if (AccessTokenTypeClaim is not null && (AccessTokenTypeValues.Count == 0 || AccessTokenTypeValues.Any(string.IsNullOrWhiteSpace))) throw new InvalidOperationException("Access-token marker values must be nonblank");
        if (ValidHeaderTypes.Any(t => !StringComparer.Ordinal.Equals(t, "at+jwt") && !StringComparer.Ordinal.Equals(t, "application/at+jwt")) && AccessTokenTypeClaim is null) throw new InvalidOperationException("Generic JWT types require an access-token marker");
    }
    private void EnsureUri(Uri uri)
    {
        if (!string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Fragment) || !(uri.Scheme == Uri.UriSchemeHttps || AllowHttpForDevelopment && uri.Scheme == Uri.UriSchemeHttp)) throw new InvalidOperationException("OIDC URLs must use HTTPS unless development HTTP is explicitly enabled");
    }
}
