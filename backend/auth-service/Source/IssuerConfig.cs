namespace Tdn.Configuration;

public class IssuerConfig
{
    public string Issuer { get; }

    public IssuerConfig()
    {
        Issuer = Environment.GetEnvironmentVariable("OIDC_ISSUER_URL")
                 ?? "http://auth-service:8080";
    }
}
