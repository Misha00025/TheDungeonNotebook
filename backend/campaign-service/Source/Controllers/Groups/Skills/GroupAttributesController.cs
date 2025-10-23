using Microsoft.AspNetCore.Mvc;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/skills/attributes")]
public class GroupAttributesController : BaseController
{
    private AttributesProvider _provider;
    
    public struct PostData
    {
        public List<AttributePostData> attributes { get; set; }
    }

    public GroupAttributesController(AttributesProvider attributesProvider)
    {
        _provider = attributesProvider;
    }
    
    [HttpGet]
    public ActionResult GetAttributes(int groupId)
    {
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