namespace Tdn.Db.Entities;

/// <summary>
/// Право доступа к игровой системе (админ). Субъект — user / group / admin.
/// </summary>
public class SystemAdminData
{
    public string SystemId { get; set; } = "";

    public string SubjectType { get; set; } = "";

    public string SubjectId { get; set; } = "";
}
