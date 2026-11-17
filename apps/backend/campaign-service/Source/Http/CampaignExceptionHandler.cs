using System.Data.Common;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Campaigns.Campaigns;
using Tdn.Campaigns.Persistence;

namespace Tdn.Campaigns.Http;

public sealed class CampaignExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
            return false;

        var (status, code, title, message, resourceId, requestId) = exception switch
        {
            DomainException domain => (domain.StatusCode, domain.Code, domain.Message, domain.Message, domain.ResourceId, domain.RequestId),
            CampaignStoreException store => (503, store.WriteOutcomeUnknown ? "write_outcome_unknown" : "dependency_unavailable", "Service unavailable", "The campaign store is temporarily unavailable.", (int?)null, (Guid?)null),
            DbUpdateException => (503, "write_outcome_unknown", "Service unavailable", "The write outcome could not be confirmed.", (int?)null, (Guid?)null),
            DbException => (503, "dependency_unavailable", "Service unavailable", "The campaign store is temporarily unavailable.", (int?)null, (Guid?)null),
            _ => (500, "internal_error", "Internal server error", "The request could not be completed.", (int?)null, (Guid?)null)
        };

        httpContext.Response.StatusCode = status;
        httpContext.Response.ContentType = "application/problem+json";
        var problem = new ProblemDetails { Status = status, Title = title, Detail = message };
        problem.Extensions["code"] = code;
        if (resourceId is not null)
            problem.Extensions["resourceId"] = resourceId;
        if (requestId is not null)
            problem.Extensions["requestId"] = requestId;
        await httpContext.Response.WriteAsJsonAsync(problem, options: null, contentType: "application/problem+json", cancellationToken: cancellationToken);
        return true;
    }
}
