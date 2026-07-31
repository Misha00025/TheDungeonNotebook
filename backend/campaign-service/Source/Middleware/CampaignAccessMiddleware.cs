using System.Text.RegularExpressions;
using Tdn.Models.Access;

namespace Tdn.Middleware;

public class CampaignAccessMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CampaignAccessMiddleware> _logger;

    private enum PermissionLevel { None, Member, Admin, CharacterWrite }

    public CampaignAccessMiddleware(RequestDelegate next, ILogger<CampaignAccessMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, SubjectAccessHelper accessHelper)
    {
        var subject = context.Items["Subject"] as Subject;
        var path = context.Request.Path.Value ?? "";
        var method = context.Request.Method;

        _logger.LogInformation("[CAMPAIGN ACCESS] IN: {Method} {Path}, Subject={Subject}", method, path, subject);

        if (subject == null)
        {
            _logger.LogWarning("[CAMPAIGN ACCESS] DECISION: 403 - no Subject present");
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        int? groupId = ExtractGroupId(path);
        int? characterId = ExtractCharacterId(path);

        _logger.LogInformation("[CAMPAIGN ACCESS] Subject=({Type},{Id}), groupId={Gid}, characterId={Cid}",
            subject.Type, subject.Id, groupId, characterId);

        if (groupId == null && subject.Type == SubjectType.Group)
        {
            _logger.LogWarning("[CAMPAIGN ACCESS] DECISION: 403 - Group token without groupId in URL");
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        if (groupId == null)
        {
            _logger.LogInformation("[CAMPAIGN ACCESS] DECISION: allow - no groupId in URL, let controller decide");
            await _next(context);
            return;
        }

        var requiredLevel = GetRequiredPermission(path, method);
        _logger.LogInformation("[CAMPAIGN ACCESS] Required permission: {Level}", requiredLevel);

        if (requiredLevel == PermissionLevel.None)
        {
            _logger.LogInformation("[CAMPAIGN ACCESS] DECISION: None permission - skip access checks, let controller decide");
            await _next(context);
            return;
        }

        var hasGroupAccess = accessHelper.HasGroupAccess(groupId.Value);
        _logger.LogInformation("[CAMPAIGN ACCESS] HasGroupAccess({GroupId}) = {Result}", groupId, hasGroupAccess);

        if (!hasGroupAccess)
        {
            _logger.LogWarning("[CAMPAIGN ACCESS] DECISION: 404 - no group access");
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        if (characterId.HasValue)
        {
            var hasCharAccess = accessHelper.HasCharacterAccess(groupId.Value, characterId.Value);
            _logger.LogInformation("[CAMPAIGN ACCESS] HasCharacterAccess({GroupId},{CharId}) = {Result}",
                groupId, characterId, hasCharAccess);

            if (!hasCharAccess)
            {
                _logger.LogWarning("[CAMPAIGN ACCESS] DECISION: 403 - no character access");
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }
        }

        if (requiredLevel == PermissionLevel.Admin && !accessHelper.IsAdmin(groupId.Value))
        {
            _logger.LogWarning("[CAMPAIGN ACCESS] DECISION: 403 - admin permission required");
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        if (requiredLevel == PermissionLevel.CharacterWrite && characterId.HasValue
            && !accessHelper.CanWriteCharacter(groupId.Value, characterId.Value))
        {
            _logger.LogWarning("[CAMPAIGN ACCESS] DECISION: 403 - character write permission required");
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        _logger.LogInformation("[CAMPAIGN ACCESS] DECISION: allow -> next");
        await _next(context);
    }

    private static PermissionLevel GetRequiredPermission(string path, string method)
    {
        var segments = path.Trim('/').Split('/');

        if (segments.Length < 2 || segments[0] != "groups")
        {
            if (segments[0] == "schemas" && segments.Length >= 3 && segments[1] == "groups")
            {
                // /schemas/groups/{groupId}/{resource}
                var schemaGroup = segments[3];
                switch (schemaGroup)
                {
                    case "items":
                    case "skills":
                    case "template":
                    case "characters":
                        return method == "GET" ? PermissionLevel.Member : PermissionLevel.Admin;
                    default:
                        return method == "GET" ? PermissionLevel.Member : PermissionLevel.Admin;
                }
            }
            return PermissionLevel.None;
        }

        // /groups/{id}
        if (segments.Length == 2)
        {
            if (method == "GET" || method == "HEAD") return PermissionLevel.Member;
            if (method == "PATCH" || method == "DELETE") return PermissionLevel.Admin;
            return PermissionLevel.Member;
        }

        var resource = segments[2];

        switch (resource)
        {
            case "users":
                return method == "GET" ? PermissionLevel.Member : PermissionLevel.Admin;

            case "items":
            case "skills":
            case "schemas":
                return method == "GET" ? PermissionLevel.Member : PermissionLevel.Admin;

            case "export":
                return PermissionLevel.Member;

            case "import":
                return PermissionLevel.Admin;

            case "quests":
                if (method == "GET")
                    return PermissionLevel.Member;
                if (method == "POST" || method == "PATCH")
                    return PermissionLevel.Member;
                return PermissionLevel.Admin;  // PUT, DELETE

            case "notes":
                // /groups/{id}/notes - collection GET is Member
                if (segments.Length == 3 && method == "GET")
                    return PermissionLevel.Member;
                // /groups/{id}/notes/{id} - single note is Admin
                return method == "GET" ? PermissionLevel.Admin : PermissionLevel.Admin;

            case "polices":
                return method == "GET" ? PermissionLevel.Member : PermissionLevel.Admin;

            case "characters":
                // /groups/{id}/characters
                if (segments.Length == 3)
                {
                    if (method == "POST") return PermissionLevel.Admin;
                    return PermissionLevel.Member;
                }

                var charAction = segments[3];

                if (charAction == "templates")
                    return method == "GET" ? PermissionLevel.Member : PermissionLevel.Admin;

                // /groups/{id}/characters/{charId}
                if (int.TryParse(charAction, out _))
                {
                    if (segments.Length == 4)
                    {
                        if (method == "GET") return PermissionLevel.Member;
                        if (method == "PATCH") return PermissionLevel.CharacterWrite;
                        if (method == "DELETE") return PermissionLevel.CharacterWrite;
                        return PermissionLevel.Member;
                    }

                    var charSub = segments[4];

                    switch (charSub)
                    {
                        case "users":
                            return method == "GET" ? PermissionLevel.Member : PermissionLevel.Admin;
                        case "items":
                        case "notes":
                        case "skills":
                            return method == "GET" ? PermissionLevel.Member : PermissionLevel.CharacterWrite;
                        case "equipment":
                            return PermissionLevel.CharacterWrite;
                        case "log":
                            return PermissionLevel.Member;
                    }
                }
                break;
        }

        return PermissionLevel.None;
    }

    private static int? ExtractGroupId(string path)
    {
        var match = Regex.Match(path, @"/groups/(\d+)");
        if (match.Success && int.TryParse(match.Groups[1].Value, out var id))
            return id;
        return null;
    }

    private static int? ExtractCharacterId(string path)
    {
        var match = Regex.Match(path, @"/characters/(\d+)");
        if (match.Success && int.TryParse(match.Groups[1].Value, out var id))
            return id;
        return null;
    }
}
