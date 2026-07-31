using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models;
using Tdn.Models.Access;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;
using Tdn.Models.DTOs;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/skills/attributes")]
public class GroupAttributesController : GroupsBaseController
{
    private AttributesProvider _provider;

    public GroupAttributesController(CampaignContext context, AttributesProvider attributesProvider, GroupAccessHelper accessHelper, SubjectAccessHelper subjectAccessHelper) : base(context, accessHelper, subjectAccessHelper)
    {
        _provider = attributesProvider;
    }
    
    [HttpGet]
    public ActionResult GetAttributes(int groupId, [FromQuery] int? userId = null)
    {
        if (userId != null && !CheckGroupAccess(groupId, userId))
            return NotFound("Group not found");
        var attributes = _provider.GetAttributes(groupId);
        return Ok(new 
        {
            attributes = attributes.Select(e => e.ToResponse()).ToList(),
            total = attributes.Count
        });
    }

    private Tdn.Models.Attribute ToAttribute(AttributePostData data) => new ()
    {
        Key = data.Key ?? "",
        Name = data.Name ?? "",
        Description = data.Description ?? "",
        IsFiltered = data.isFiltered ?? false
    };
    
    [HttpPut]
    public ActionResult PutAttribute(int groupId, [FromBody] PostData data)
    {
        var attributesData = data.attributes.Where(e => e.Key != null && e.Name != null);
        var attributes = attributesData.Select(ToAttribute).ToList();
        var oldAttributes = _provider.GetAttributes(groupId);
        attributes = attributes.Select(e =>
        {
            var old = oldAttributes.Where(o => o.Key == e.Key).FirstOrDefault();
            if (old != null)
                e.KnownValues = old.KnownValues;
            return e;
        }).ToList();
        bool success;
        success = _provider.TrySaveAttributes(groupId, attributes);
        if (success)
            return Ok();
        else
            return BadRequest("Unknown error");
    }
}
