using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Tdn.Bff.Errors;
using Tdn.Bff.Sessions;

namespace Tdn.Bff.GmCharacters;

public sealed class GmCharacterCollectionService(IHttpClientFactory clients, IConfiguration configuration, ISessionTokenService tokens)
{
    private const string ClientName = "gm-character-collection";
    private static readonly HashSet<string> QueryNames = ["search", "importance", "hasPlayers", "playerAccess", "include"];
    private const string ProfileUnavailable = "Профиль недоступен";

    public async Task<IResult> ListAsync(HttpContext context, int campaignId)
    {
        context.Response.Headers.CacheControl = "no-store";
        var parsed = ParseQuery(context.Request.Query);
        if (parsed is null)
            return BadRequest();

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

        var list = await GetJsonAsync(client, $"api/campaigns/{campaignId}/characters", context.RequestAborted).ConfigureAwait(false);
        if (list.Error is not null) return Forward(list.Error);
        if (list.Value is not JsonArray source) return InvalidUpstream();
        var validatedCharacters = new List<JsonObject>(source.Count);
        foreach (var row in source)
        {
            if (row is not JsonObject character || !HasValidMetadata(character))
                return InvalidUpstream();
            validatedCharacters.Add(character);
        }

        var candidates = validatedCharacters
            .Where(item => MatchesMetadata(item, parsed))
            .ToArray();
        var needsAssignments = parsed.IncludeAssignments || parsed.HasPlayers.HasValue || parsed.PlayerAccess is not null;
        var output = new JsonArray();
        var profileNames = new Dictionary<int, Task<string>>();
        foreach (var character in candidates)
        {
            var id = character["id"]!.GetValue<string>();
            JsonArray? assignments = null;
            if (needsAssignments)
            {
                var result = await GetJsonAsync(client, $"api/campaigns/{campaignId}/characters/{Uri.EscapeDataString(id)}/assignments", context.RequestAborted).ConfigureAwait(false);
                if (result.Error is not null) return Forward(result.Error);
                assignments = result.Value as JsonArray;
                if (assignments is null) return InvalidUpstream();
                var validatedAssignments = new List<JsonObject>(assignments.Count);
                foreach (var row in assignments)
                {
                    if (row is not JsonObject assignment ||
                        !TryInt(assignment["userId"], out _) ||
                        assignment["canWrite"] is not JsonValue canWriteNode ||
                        !canWriteNode.TryGetValue<bool>(out _))
                        return InvalidUpstream();
                    validatedAssignments.Add(assignment);
                }
                assignments = new JsonArray(validatedAssignments.Select(assignment => assignment.DeepClone()).ToArray());
                if (parsed.HasPlayers == true && assignments.Count == 0 || parsed.HasPlayers == false && assignments.Count != 0)
                    continue;
                if (parsed.PlayerAccess is not null && !assignments.OfType<JsonObject>().Any(a =>
                        a["canWrite"]!.GetValue<bool>() == (parsed.PlayerAccess == "write")))
                    continue;
            }

            JsonObject? permissions = null;
            if (parsed.IncludePermissions)
            {
                var result = await GetJsonAsync(client, $"api/campaigns/{campaignId}/characters/{Uri.EscapeDataString(id)}/permissions", context.RequestAborted).ConfigureAwait(false);
                if (result.Error is not null) return Forward(result.Error);
                if (result.Value is not JsonObject upstreamPermissions) return InvalidUpstream();
                permissions = new JsonObject();
                foreach (var key in new[] { "canRead", "canWrite", "canManageAccess" })
                {
                    if (upstreamPermissions[key] is not JsonValue value || !value.TryGetValue<bool>(out var flag))
                        return InvalidUpstream();
                    permissions[key] = flag;
                }
            }

            var item = ProjectMetadata(character);
            if (permissions is not null)
                item["permissions"] = permissions;
            if (parsed.IncludeAssignments)
            {
                var assignedPlayers = new JsonArray();
                foreach (var assignment in assignments!.OfType<JsonObject>())
                {
                    if (!TryInt(assignment["userId"], out var userId) || assignment["canWrite"] is not JsonValue canWriteNode || !canWriteNode.TryGetValue<bool>(out var canWrite))
                        return InvalidUpstream();
                    if (!profileNames.TryGetValue(userId, out var profileNameTask))
                    {
                        profileNameTask = GetProfileNameAsync(client, userId, context.RequestAborted);
                        profileNames.Add(userId, profileNameTask);
                    }
                    var displayName = await profileNameTask.ConfigureAwait(false);
                    assignedPlayers.Add(new JsonObject { ["userId"] = userId, ["displayName"] = displayName, ["canWrite"] = canWrite });
                }
                item["assignedPlayers"] = assignedPlayers;
            }
            output.Add(item);
        }

        return Results.Json(new JsonObject { ["characters"] = output }, statusCode: StatusCodes.Status200OK);
    }

    private static ParsedQuery? ParseQuery(IQueryCollection query)
    {
        if (query.Keys.Any(key => !QueryNames.Contains(key)))
            return null;
        string? Scalar(string key)
        {
            if (!query.TryGetValue(key, out var values)) return null;
            return values.Count == 1 ? values[0] : "\0";
        }

        var search = Scalar("search");
        var importance = Scalar("importance");
        var hasPlayersText = Scalar("hasPlayers");
        var playerAccess = Scalar("playerAccess");
        if (search == "\0" || importance == "\0" || hasPlayersText == "\0" || playerAccess == "\0")
            return null;
        if (importance is not null && importance is not ("Background" or "Secondary" or "Key"))
            return null;
        bool? hasPlayers = null;
        if (hasPlayersText is not null)
        {
            if (!bool.TryParse(hasPlayersText, out var value)) return null;
            hasPlayers = value;
        }
        if (playerAccess is not null && playerAccess is not ("write" or "readOnly"))
            return null;
        var includes = query.TryGetValue("include", out var includeValues) ? includeValues : [];
        if (includes.Any(value => value is not ("permissions" or "assignments")))
            return null;
        return new ParsedQuery(search, importance, hasPlayers, playerAccess, includes.Contains("permissions"), includes.Contains("assignments"));
    }

    private static bool MatchesMetadata(JsonObject item, ParsedQuery query)
    {
        if (query.Importance is not null && item["importance"]?.GetValue<string>() != query.Importance)
            return false;
        return query.Search is null || item["name"]?.GetValue<string>()?.Contains(query.Search, StringComparison.OrdinalIgnoreCase) == true;
    }

    private static bool HasValidMetadata(JsonObject character) =>
        character["id"] is JsonValue id && id.TryGetValue<string>(out var idValue) && !string.IsNullOrWhiteSpace(idValue) &&
        character["campaignId"] is JsonValue campaignId && campaignId.TryGetValue<int>(out _) &&
        character["name"] is JsonValue name && name.TryGetValue<string>(out _) &&
        character["importance"] is JsonValue importance && importance.TryGetValue<string>(out var importanceValue) &&
        importanceValue is "Background" or "Secondary" or "Key" &&
        character["metadataRevision"] is JsonValue revision && (revision.TryGetValue<int>(out _) || revision.TryGetValue<long>(out _));

    private static JsonObject ProjectMetadata(JsonObject source)
    {
        var projected = new JsonObject();
        foreach (var key in new[] { "id", "campaignId", "name", "importance", "metadataRevision" })
            if (source[key] is { } value)
                projected[key] = value.DeepClone();
        return projected;
    }

    private static string ReadProfileName(JsonObject profile)
    {
        var visible = profile["visibleName"]?.GetValue<string>()?.Trim();
        if (!string.IsNullOrEmpty(visible)) return visible;
        var nickname = profile["nickname"]?.GetValue<string>()?.Trim();
        return string.IsNullOrEmpty(nickname) ? ProfileUnavailable : nickname;
    }

    private static bool TryInt(JsonNode? node, out int value) =>
        node is JsonValue json && json.TryGetValue<int>(out value) || int.TryParse(node?.ToString(), out value);

    private static async Task<string> GetProfileNameAsync(HttpClient client, int userId, CancellationToken cancellationToken)
    {
        try
        {
            var profile = await GetJsonAsync(client, $"users/{userId}", cancellationToken).ConfigureAwait(false);
            return profile.Error is null && profile.Value is JsonObject profileObject
                ? ReadProfileName(profileObject)
                : ProfileUnavailable;
        }
        catch (HttpRequestException)
        {
            return ProfileUnavailable;
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return ProfileUnavailable;
        }
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
        return value is null
            ? (null, new UpstreamFailure(StatusCodes.Status502BadGateway, "{\"code\":\"invalid_upstream_response\"}", "application/json"))
            : (value, null);
    }

    private static IResult BadRequest() => Results.Json(new { code = "invalid_query", title = "Bad Request", detail = "Query parameters are invalid." }, statusCode: StatusCodes.Status400BadRequest);
    private static IResult InvalidUpstream() => Results.Json(new { code = "invalid_upstream_response", title = "Bad Gateway", detail = "Gateway returned an invalid response." }, statusCode: StatusCodes.Status502BadGateway);
    private static IResult Forward(UpstreamFailure failure) => new UpstreamResult(failure);
    private sealed record ParsedQuery(string? Search, string? Importance, bool? HasPlayers, string? PlayerAccess, bool IncludePermissions, bool IncludeAssignments);
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
