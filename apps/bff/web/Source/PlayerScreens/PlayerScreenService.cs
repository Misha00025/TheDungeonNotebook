using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Tdn.Bff.Errors;
using Tdn.Bff.Sessions;

namespace Tdn.Bff.PlayerScreens;

public sealed class PlayerScreenService(IHttpClientFactory clients, IConfiguration configuration, ISessionTokenService tokens)
{
    private const string ClientName = "player-screens";

    public async Task<IResult> ListCharactersAsync(HttpContext context, int campaignId)
    {
        context.Response.Headers.CacheControl = "no-store";
        var client = await CreateClientAsync(context).ConfigureAwait(false);
        var options = await GetWritableOptionsAsync(client, campaignId, context.RequestAborted).ConfigureAwait(false);
        return options.Error is not null
            ? Forward(options.Error)
            : Results.Json(new JsonObject { ["characters"] = options.Value }, statusCode: StatusCodes.Status200OK);
    }

    public async Task<IResult> GetCharacterScreenAsync(HttpContext context, int campaignId, string characterId)
    {
        context.Response.Headers.CacheControl = "no-store";
        var client = await CreateClientAsync(context).ConfigureAwait(false);
        var prefix = $"api/campaigns/{campaignId}/characters/{Uri.EscapeDataString(characterId)}";
        var permissions = await GetJsonAsync(client, $"{prefix}/permissions", context.RequestAborted);
        if (permissions.Error is not null)
            return Forward(permissions.Error);

        var canRead = permissions.Value?["canRead"]?.GetValue<bool>() == true;
        var canWrite = permissions.Value?["canWrite"]?.GetValue<bool>() == true;
        if (!canRead && !canWrite)
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Forbidden", detail: "Character access is not available.");

        var metadata = await GetJsonAsync(client, prefix, context.RequestAborted);
        if (metadata.Error is not null) return Forward(metadata.Error);
        var computed = await GetJsonAsync(client, $"{prefix}/computed-sheet", context.RequestAborted);
        if (computed.Error is not null) return Forward(computed.Error);
        var presentation = await GetJsonAsync(client, $"api/campaigns/{campaignId}/presentation", context.RequestAborted);
        if (presentation.Error is not null) return Forward(presentation.Error);
        var available = await GetWritableOptionsAsync(client, campaignId, context.RequestAborted).ConfigureAwait(false);
        if (available.Error is not null) return Forward(available.Error);

        var defaults = presentation.Value?["defaults"] as JsonObject ?? new JsonObject();
        var resolved = new JsonObject();
        foreach (var item in defaults)
        {
            if (string.IsNullOrWhiteSpace(item.Value?.GetValue<string>()))
                continue;
            var contextKey = item.Key;
            var result = await GetJsonAsync(client, $"api/campaigns/{campaignId}/presentation/resolve?contextKey={Uri.EscapeDataString(contextKey)}", context.RequestAborted);
            if (result.Error is not null) return Forward(result.Error);
            resolved[contextKey] = result.Value!.DeepClone();
        }

        return Results.Json(new JsonObject
        {
            ["character"] = metadata.Value!.DeepClone(),
            ["permissions"] = new JsonObject { ["canRead"] = canRead, ["canWrite"] = canWrite },
            ["computedSheet"] = computed.Value!.DeepClone(),
            ["presentation"] = presentation.Value!.DeepClone(),
            ["resolvedPresentations"] = resolved,
            ["availableCharacters"] = available.Value
        }, statusCode: StatusCodes.Status200OK);
    }

    private async Task<HttpClient> CreateClientAsync(HttpContext context)
    {
        var sessionKey = context.User.FindFirst(BffAuthenticationDefaults.SessionClaim)?.Value;
        if (string.IsNullOrWhiteSpace(sessionKey))
            throw new AuthenticationRequiredException();
        var address = configuration["ReverseProxy:Clusters:gateway:Destinations:gateway:Address"];
        if (!Uri.TryCreate(address, UriKind.Absolute, out var baseAddress))
            throw new InvalidOperationException("Configured Gateway destination is invalid.");
        var client = clients.CreateClient(ClientName);
        client.BaseAddress = baseAddress;
        var token = await tokens.GetAccessTokenAsync(sessionKey, context.RequestAborted).ConfigureAwait(false);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private static async Task<(JsonArray? Value, UpstreamFailure? Error)> GetWritableOptionsAsync(HttpClient client, int campaignId, CancellationToken cancellationToken)
    {
        var characters = await GetJsonAsync(client, $"api/campaigns/{campaignId}/characters", cancellationToken).ConfigureAwait(false);
        if (characters.Error is not null)
            return (null, characters.Error);
        var options = new JsonArray();
        foreach (var character in characters.Value!.AsArray())
        {
            var id = character?["id"]?.GetValue<string>();
            if (id is null)
                continue;
            var permissions = await GetJsonAsync(client, $"api/campaigns/{campaignId}/characters/{Uri.EscapeDataString(id)}/permissions", cancellationToken).ConfigureAwait(false);
            if (permissions.Error is not null)
                return (null, permissions.Error);
            if (permissions.Value?["canWrite"]?.GetValue<bool>() != true)
                continue;
            options.Add(new JsonObject
            {
                ["id"] = character!["id"]?.DeepClone(),
                ["campaignId"] = character["campaignId"]?.DeepClone(),
                ["name"] = character["name"]?.DeepClone(),
                ["importance"] = character["importance"]?.DeepClone(),
                ["metadataRevision"] = character["metadataRevision"]?.DeepClone(),
                ["canWrite"] = true
            });
        }
        return (options, null);
    }

    private static async Task<(JsonNode? Value, UpstreamFailure? Error)> GetJsonAsync(HttpClient client, string path, CancellationToken cancellationToken)
    {
        using var response = await client.GetAsync(path, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
        var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        JsonNode? value = null;
        if (!string.IsNullOrWhiteSpace(body))
        {
            try { value = JsonNode.Parse(body); } catch (JsonException) { }
        }
        if (!response.IsSuccessStatusCode)
            return (null, new UpstreamFailure((int)response.StatusCode, body, response.Content.Headers.ContentType?.ToString()));
        if (value is null)
            return (null, new UpstreamFailure(StatusCodes.Status502BadGateway, "{\"code\":\"invalid_upstream_response\"}", "application/json"));
        return (value, null);
    }

    private static IResult Forward(UpstreamFailure failure) => new UpstreamResult(failure);

    private sealed record UpstreamFailure(int Status, string Body, string? ContentType);

    private sealed class UpstreamResult(UpstreamFailure failure) : IResult
    {
        public async Task ExecuteAsync(HttpContext context)
        {
            context.Response.StatusCode = failure.Status;
            context.Response.Headers.CacheControl = "no-store";
            context.Response.ContentType = string.IsNullOrWhiteSpace(failure.ContentType) ? "application/json" : failure.ContentType;
            await context.Response.WriteAsync(failure.Body, context.RequestAborted).ConfigureAwait(false);
        }
    }
}
