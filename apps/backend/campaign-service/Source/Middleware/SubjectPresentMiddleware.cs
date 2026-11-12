using System.Text.Json;
using System.Text.Json.Serialization;
using Tdn.Models.Access;

namespace Tdn.Middleware;

public class SubjectPresentMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SubjectPresentMiddleware> _logger;

    public SubjectPresentMiddleware(RequestDelegate next, ILogger<SubjectPresentMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var header = context.Request.Headers["X-Subject"].FirstOrDefault();

        if (string.IsNullOrEmpty(header))
        {
            _logger.LogInformation("X-Subject not present");
            await _next(context);
            return;
        }

        try
        {
            var subject = JsonSerializer.Deserialize<Subject>(header, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                Converters = { new JsonStringEnumConverter() }
            });

            if (subject != null)
            {
                context.Items["Subject"] = subject;
                _logger.LogInformation("X-Subject present: {Type}:{Id}", subject.Type, subject.Id);
            }
        }
        catch (JsonException)
        {
            // Invalid JSON — do nothing, don't log error, don't return 400
        }

        await _next(context);
    }
}
