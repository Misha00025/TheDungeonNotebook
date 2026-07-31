using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Providing;
using Tdn.Models.Access;

namespace Tdn.Api.Controllers;

public abstract class GroupsBaseController : BaseController
{
    private CampaignContext _db;
    private GroupAccessHelper _accessHelper;
    private SubjectAccessHelper _subjectAccessHelper;
    
    public GroupsBaseController(CampaignContext context, GroupAccessHelper accessHelper, SubjectAccessHelper subjectAccessHelper)
    {
        _db = context;
        _accessHelper = accessHelper;
        _subjectAccessHelper = subjectAccessHelper;
    }

    protected GroupAccessHelper AccessHelper => _accessHelper;
    protected SubjectAccessHelper SubjectAccess => _subjectAccessHelper;

    protected bool TryGetGroup(int groupId, out GroupData group)
    {
        var tmp = _db.Groups.Where(e => e.Id == groupId).FirstOrDefault();
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
