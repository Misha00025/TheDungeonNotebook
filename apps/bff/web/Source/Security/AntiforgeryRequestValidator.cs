using Microsoft.AspNetCore.Antiforgery;

namespace Tdn.Bff.Security;

public sealed class AntiforgeryRequestValidator : IAntiforgeryRequestValidator
{
    private readonly IAntiforgery _antiforgery;

    public AntiforgeryRequestValidator(IAntiforgery antiforgery)
    {
        _antiforgery = antiforgery;
    }

    public Task ValidateUnsafeRequestAsync(HttpContext context)
    {
        if (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method) || HttpMethods.IsOptions(context.Request.Method) || HttpMethods.IsTrace(context.Request.Method))
            return Task.CompletedTask;
        return _antiforgery.ValidateRequestAsync(context);
    }
}
