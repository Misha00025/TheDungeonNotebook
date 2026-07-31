using Microsoft.Extensions.Logging;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Providing;
using Tdn.Models.Access;

namespace Tdn.Api.Controllers;

public abstract class GroupsBaseController : BaseController
{
    private CampaignContext _db;
    private SubjectAccessHelper _subjectAccessHelper;
    private ILogger<GroupsBaseController> _logger;
    
    public GroupsBaseController(CampaignContext context, SubjectAccessHelper subjectAccessHelper, ILogger<GroupsBaseController> logger)
    {
        _db = context;
        _subjectAccessHelper = subjectAccessHelper;
        _logger = logger;
    }

    protected SubjectAccessHelper SubjectAccess => _subjectAccessHelper;

    protected bool TryGetGroup(int groupId, out GroupData group)
    {
        var tmp = _db.Groups.Where(e => e.Id == groupId).FirstOrDefault();
        group = tmp!;
        return tmp != null;    
    }
    
    protected bool CheckGroupAccess(int groupId)
    {
        return SubjectAccess.HasGroupAccess(groupId);
    }
    
    protected bool CheckCharacterAccess(int groupId, int characterId)
    {
        return SubjectAccess.HasCharacterAccess(groupId, characterId);
    }
}
