namespace Tdn.Bff.Errors;

public sealed class IdentityProviderUnavailableException : Exception
{
    public IdentityProviderUnavailableException(Exception? innerException = null)
        : base("The identity provider did not respond.", innerException)
    {
    }
}
