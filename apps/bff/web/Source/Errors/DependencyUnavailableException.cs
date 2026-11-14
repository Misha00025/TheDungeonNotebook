namespace Tdn.Bff.Errors;

public sealed class DependencyUnavailableException : Exception
{
    public DependencyUnavailableException(Exception? innerException = null) : base("A required dependency is unavailable.", innerException)
    {
    }
}
