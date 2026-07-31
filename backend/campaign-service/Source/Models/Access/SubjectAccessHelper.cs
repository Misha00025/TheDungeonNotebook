using Tdn.Models.Providing;

namespace Tdn.Models.Access;

public class SubjectAccessHelper
{
    private readonly GroupAccessHelper _groupAccessHelper;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<SubjectAccessHelper> _logger;

    public SubjectAccessHelper(
        GroupAccessHelper groupAccessHelper,
        IHttpContextAccessor httpContextAccessor,
        ILogger<SubjectAccessHelper> logger)
    {
        _groupAccessHelper = groupAccessHelper;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    private Subject? GetSubject() =>
        _httpContextAccessor.HttpContext?.Items["Subject"] as Subject;

    public bool HasGroupAccess(int groupId)
    {
        var subject = GetSubject();
        if (subject == null) return LogAndReturn(groupId, false, null);

        var result = subject.Type switch
        {
            SubjectType.Admin => true,
            SubjectType.Group => subject.Id == groupId,
            SubjectType.User => _groupAccessHelper.HasGroupAccess(groupId, subject.Id),
            _ => false
        };
        return LogAndReturn(groupId, result, subject);
    }

    public bool IsAdmin(int groupId)
    {
        var subject = GetSubject();
        if (subject == null) return LogAndReturn(groupId, false, null);

        var result = subject.Type switch
        {
            SubjectType.Admin => true,
            SubjectType.Group => subject.Id == groupId,
            SubjectType.User => _groupAccessHelper.IsAdmin(groupId, subject.Id),
            _ => false
        };
        return LogAndReturn(groupId, result, subject);
    }

    public bool HasCharacterAccess(int groupId, int characterId)
    {
        var subject = GetSubject();
        if (subject == null) return LogAndReturn(groupId, false, null, characterId);

        var result = subject.Type switch
        {
            SubjectType.Admin => true,
            SubjectType.Group => true,
            SubjectType.User => _groupAccessHelper.HasCharacterAccess(groupId, characterId, subject.Id),
            _ => false
        };
        return LogAndReturn(groupId, result, subject, characterId);
    }

    public bool CanWriteCharacter(int groupId, int characterId)
    {
        var subject = GetSubject();
        if (subject == null) return LogAndReturn(groupId, false, null, characterId);

        var result = subject.Type switch
        {
            SubjectType.Admin => true,
            SubjectType.Group => true,
            SubjectType.User => _groupAccessHelper.CanWriteCharacter(groupId, characterId, subject.Id),
            _ => false
        };
        return LogAndReturn(groupId, result, subject, characterId);
    }

    public List<int> GetAccessibleGroupIds()
    {
        var subject = GetSubject();
        if (subject == null) return new List<int>();
        if (subject.Type == SubjectType.Admin) return new List<int>();
        if (subject.Type == SubjectType.Group) return new List<int> { subject.Id };
        return _groupAccessHelper.GetAccessibleGroupIds(subject.Id);
    }

    public int? CurrentUserId
    {
        get
        {
            var subject = GetSubject();
            return subject?.Type == SubjectType.User ? subject.Id : null;
        }
    }

    public List<int> GetAccessibleCharacterIds(int groupId)
    {
        var subject = GetSubject();
        if (subject == null) return new List<int>();
        if (subject.Type is SubjectType.Admin or SubjectType.Group)
            return new List<int>(); // empty = "all" (caller should handle)
        return _groupAccessHelper.GetAccessibleCharacterIds(groupId, subject.Id);
    }

    private bool LogAndReturn(int groupId, bool result, Subject? subject, int? characterId = null)
    {
        var method = characterId.HasValue
            ? $"HasCharacterAccess({groupId}, {characterId.Value})"
            : $"HasGroupAccess({groupId})";
        _logger.LogInformation(
            "SubjectAccessHelper: {Method} -> {Result} [{Subject}]",
            method, result, FormatSubject(subject));
        return result;
    }

    private static string FormatSubject(Subject? subject) =>
        subject == null ? "null" : $"{subject.Type}:{subject.Id}";
}
