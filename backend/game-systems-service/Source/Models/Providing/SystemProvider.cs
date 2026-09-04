using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Access;

namespace Tdn.Models.Providing;

/// <summary>
/// CRUD игровых систем и управление версиями (ссылки на снимки в MySQL).
/// </summary>
public class SystemProvider
{
    private readonly GameSystemsContext _db;
    private readonly SnapshotProvider _snapshotProvider;
    private readonly SystemAccessHelper _accessHelper;

    public SystemProvider(GameSystemsContext db, SnapshotProvider snapshotProvider, SystemAccessHelper accessHelper)
    {
        _db = db;
        _snapshotProvider = snapshotProvider;
        _accessHelper = accessHelper;
    }

    public List<SystemData> GetAll()
    {
        return _db.Systems.OrderBy(e => e.CreatedAt).ToList();
    }

    public SystemData? Get(string systemId)
    {
        return _db.Systems.Where(e => e.Id == systemId).FirstOrDefault();
    }

    public SystemData Create(string name, string? description, string? icon)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var data = new SystemData
        {
            Id = Guid.NewGuid().ToString(),
            Name = name,
            Description = description,
            Icon = icon,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.Systems.Add(data);

        // Создатель становится админом системы.
        var subject = _accessHelper.CurrentSubject;
        if (subject != null)
        {
            _db.SystemAdmins.Add(new SystemAdminData
            {
                SystemId = data.Id,
                SubjectType = subject.Type.ToString().ToLower(),
                SubjectId = subject.Id.ToString()
            });
        }

        _db.SaveChanges();
        return data;
    }

    public SystemData? Update(string systemId, string? name, string? description, string? icon)
    {
        var data = _db.Systems.Where(e => e.Id == systemId).FirstOrDefault();
        if (data == null) return null;
        if (name != null) data.Name = name;
        if (description != null) data.Description = description;
        if (icon != null) data.Icon = icon;
        data.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        _db.SaveChanges();
        return data;
    }

    public SystemData? Delete(string systemId)
    {
        var data = _db.Systems.Where(e => e.Id == systemId).FirstOrDefault();
        if (data == null) return null;
        _db.SystemAdmins.RemoveRange(_db.SystemAdmins.Where(e => e.SystemId == systemId));
        _db.SystemVersions.RemoveRange(_db.SystemVersions.Where(e => e.SystemId == systemId));
        _db.Systems.Remove(data);
        _db.SaveChanges();
        return data;
    }

    public List<SystemVersionData> GetVersions(string systemId)
    {
        return _db.SystemVersions
            .Where(e => e.SystemId == systemId)
            .OrderBy(e => e.CreatedAt)
            .ToList();
    }

    public SystemVersionData? GetVersion(string systemId, string versionId)
    {
        return _db.SystemVersions
            .Where(e => e.SystemId == systemId && e.Id == versionId)
            .FirstOrDefault();
    }

    /// <summary>
    /// Создаёт снимок контента в MongoDB и версию-ссылку в MySQL.
    /// </summary>
    public SystemVersionData? CreateVersion(string systemId, string version, SnapshotContentData content)
    {
        var system = _db.Systems.Where(e => e.Id == systemId).FirstOrDefault();
        if (system == null) return null;

        // Уникальность версии в рамках системы.
        var exists = _db.SystemVersions.Any(e => e.SystemId == systemId && e.Version == version);
        if (exists) return null;

        var versionId = Guid.NewGuid().ToString();
        var snapshotId = _snapshotProvider.CreateSnapshot(systemId, versionId, content);

        var data = new SystemVersionData
        {
            Id = versionId,
            SystemId = systemId,
            Version = version,
            SnapshotId = snapshotId,
            CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
        };
        _db.SystemVersions.Add(data);
        _db.SaveChanges();
        return data;
    }
}
