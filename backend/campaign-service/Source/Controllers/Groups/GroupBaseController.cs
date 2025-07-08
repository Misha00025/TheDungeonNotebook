using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Api.Controllers;

public abstract class GroupsBaseController : BaseController
{

    private GroupContext _groupContext;
    
    public GroupsBaseController(GroupContext context)
    {
        _groupContext = context;
    }

    protected GroupContext GroupContext => _groupContext;

    protected bool TryGetGroup(int groupId, out GroupData group)
    {
        var tmp = GroupContext.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        group = tmp!;
        return tmp != null;    
    }
}