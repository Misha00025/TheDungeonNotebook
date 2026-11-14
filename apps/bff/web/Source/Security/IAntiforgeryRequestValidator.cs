namespace Tdn.Bff.Security;

public interface IAntiforgeryRequestValidator
{
    Task ValidateUnsafeRequestAsync(HttpContext context);
}
