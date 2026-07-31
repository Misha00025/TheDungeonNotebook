using Microsoft.Extensions.Logging;
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
    private ILogger<GroupsBaseController> _logger;
    
    public GroupsBaseController(CampaignContext context, GroupAccessHelper accessHelper, SubjectAccessHelper subjectAccessHelper, ILogger<GroupsBaseController> logger)
    {
        _db = context;
        _accessHelper = accessHelper;
        _subjectAccessHelper = subjectAccessHelper;
        _logger = logger;
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
        bool userIdGranted = userId != null && AccessHelper.HasGroupAccess(groupId, userId.Value);
        bool subjectGranted = SubjectAccess.HasGroupAccess(groupId);
        
        if (userIdGranted != subjectGranted && userId != null)
        {
            _logger.LogWarning(
                "Access divergence for group {GroupId}: userId-check={UserIdGranted} (userId={UserId}), subject-check={SubjectGranted}",
                groupId, userIdGranted, userId, subjectGranted);
        }
        
        return userIdGranted || subjectGranted;
    }
    
    protected bool CheckCharacterAccess(int groupId, int characterId, int? userId)
    {
        bool userIdGranted = userId != null && AccessHelper.HasCharacterAccess(groupId, characterId, userId.Value);
        bool subjectGranted = SubjectAccess.HasCharacterAccess(groupId, characterId);
        
        if (userIdGranted != subjectGranted && userId != null)
        {
            _logger.LogWarning(
                "Access divergence for character {CharacterId} in group {GroupId}: userId-check={UserIdGranted} (userId={UserId}), subject-check={SubjectGranted}",
                characterId, groupId, userIdGranted, userId, subjectGranted);
        }
        
        return userIdGranted || subjectGranted;
    }
}
