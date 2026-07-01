using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class GroupAccessHelper
{
    private readonly PolicesContext _policesContext;

    public GroupAccessHelper(PolicesContext policesContext)
    {
        _policesContext = policesContext;
    }

    /// <summary>
    /// Возвращает список group_id, к которым пользователь имеет доступ
    /// </summary>
    public List<int> GetAccessibleGroupIds(int userId)
    {
        return _policesContext.Groups
            .Where(g => g.UserId == userId)
            .Select(g => g.GroupId)
            .ToList();
    }

    /// <summary>
    /// Есть ли у пользователя доступ к группе
    /// </summary>
    public bool HasGroupAccess(int groupId, int userId)
    {
        return _policesContext.Groups
            .Any(g => g.GroupId == groupId && g.UserId == userId);
    }

    /// <summary>
    /// Является ли пользователь администратором группы
    /// </summary>
    public bool IsAdmin(int groupId, int userId)
    {
        return _policesContext.Groups
            .Any(g => g.GroupId == groupId && g.UserId == userId && g.IsAdmin);
    }

    /// <summary>
    /// Возвращает список character_id, к которым пользователь имеет доступ в рамках группы
    /// </summary>
    public List<int> GetAccessibleCharacterIds(int groupId, int userId)
    {
        return _policesContext.Characters
            .Where(c => c.GroupId == groupId && c.UserId == userId)
            .Select(c => c.CharacterId)
            .ToList();
    }

    /// <summary>
    /// Есть ли у пользователя доступ к персонажу
    /// </summary>
    public bool HasCharacterAccess(int groupId, int characterId, int userId)
    {
        var isGroupAdmin = IsAdmin(groupId, userId);
        if (isGroupAdmin) return true;

        return _policesContext.Characters
            .Any(c => c.GroupId == groupId && c.CharacterId == characterId && c.UserId == userId);
    }

    /// <summary>
    /// Может ли пользователь писать в персонажа
    /// </summary>
    public bool CanWriteCharacter(int groupId, int characterId, int userId)
    {
        var isGroupAdmin = IsAdmin(groupId, userId);
        if (isGroupAdmin) return true;

        return _policesContext.Characters
            .Any(c => c.GroupId == groupId && c.CharacterId == characterId && c.UserId == userId && c.CanWrite);
    }
}
