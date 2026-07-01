using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

public abstract class GroupsBaseController : BaseController
{
    private GroupContext _groupContext;
    private GroupAccessHelper _accessHelper;
    
    public GroupsBaseController(GroupContext context, GroupAccessHelper accessHelper)
    {
        _groupContext = context;
        _accessHelper = accessHelper;
    }

    protected GroupContext GroupContext => _groupContext;
    protected GroupAccessHelper AccessHelper => _accessHelper;

    protected bool TryGetGroup(int groupId, out GroupData group)
    {
        var tmp = GroupContext.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        group = tmp!;
        return tmp != null;    
    }
    
    protected bool CheckGroupAccess(int groupId, int? userId)
    {
        if (userId == null)
            return true;
        return AccessHelper.HasGroupAccess(groupId, userId.Value);
    }
    
    protected bool CheckCharacterAccess(int groupId, int characterId, int? userId)
    {
        if (userId == null)
            return true;
        return AccessHelper.HasCharacterAccess(groupId, characterId, userId.Value);
    }
}
