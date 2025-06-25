using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

public abstract class GroupsBaseController : BaseController
{

    private GroupContext _groupContext;
    
    public GroupsBaseController(GroupContext context)
    {
        _groupContext = context;
    }

    protected GroupContext GroupContext => GroupContext;

    protected bool TryGetGroup(int groupId, out GroupData group)
    {
        var tmp = GroupContext.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        group = tmp!;
        return tmp != null;    
    }
}