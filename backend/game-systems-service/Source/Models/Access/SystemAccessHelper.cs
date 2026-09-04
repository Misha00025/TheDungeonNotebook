using Tdn.Db.Contexts;

namespace Tdn.Models.Access;

/// <summary>
/// Авторизация для game-systems-service поверх X-Subject.
/// Одна роль — админ: субъект (user/group/admin) является админом системы,
/// если он записан в system_admins, либо это глобальный admin (type=admin).
/// </summary>
public class SystemAccessHelper
{
    private readonly GameSystemsContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public SystemAccessHelper(GameSystemsContext db, IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
    }

    private Subject? GetSubject() =>
        _httpContextAccessor.HttpContext?.Items["Subject"] as Subject;

    /// <summary>Текущий субъект из X-Subject (может быть null).</summary>
    public Subject? CurrentSubject => GetSubject();

    /// <summary>Есть ли вообще идентифицированный субъект.</summary>
    public bool IsAuthenticated() => GetSubject() != null;

    /// <summary>
    /// Является ли текущий субъект админом системы.
    /// Глобальный admin (type=admin) имеет доступ ко всем системам.
    /// </summary>
    public bool IsAdmin(string systemId)
    {
        var subject = GetSubject();
        if (subject == null) return false;
        if (subject.Type == SubjectType.Admin) return true;

        return _db.SystemAdmins.Any(e =>
            e.SystemId == systemId &&
            e.SubjectType == subject.Type.ToString().ToLower() &&
            e.SubjectId == subject.Id.ToString());
    }
}
