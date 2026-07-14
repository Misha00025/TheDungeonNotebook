namespace Tdn.Configuration;

public class OidcConfig
{
    public string Issuer { get; }

    public OidcConfig()
    {
        Issuer = Environment.GetEnvironmentVariable("OIDC_ISSUER_URL")
                 ?? "http://auth-service:8080";
    }
}
