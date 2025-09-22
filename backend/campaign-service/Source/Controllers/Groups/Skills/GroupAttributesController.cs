using Microsoft.AspNetCore.Mvc;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/skills/attributes")]
public class GroupAttributesController : BaseController
{
    private AttributesProvider _provider;

    public struct AttributePostData 
    {
        public string? Key;
        public string? Name;
        public string? Description;
        public bool? isFiltered;
    }

    public GroupAttributesController(AttributesProvider attributesProvider)
    {
        _provider = attributesProvider;
    }

    private object ToResponse(Tdn.Models.Attribute attribute) => new
    {
        key = attribute.Key,
        name = attribute.Name,
        description = attribute.Description,
        knownValues = attribute.KnownValues,
        isFiltered = attribute.IsFiltered
    };
    
    [HttpGet]
    public ActionResult GetAttributes(int groupId)
    {
        var attributes = _provider.GetAttributes(groupId);
        return Ok(new 
        {
            attributes = attributes.Select(ToResponse).ToList(),
            total = attributes.Count
        });
    }
    
    [HttpPut]
    public ActionResult PutAttribute(int groupId, [FromBody] AttributePostData data)
    {
        if (data.Name == null || data.Key == null)
            return BadRequest("Name and Key must not be null");
    
        Tdn.Models.Attribute attribute;
        var exist = _provider.TryGetAttribute(groupId, data.Key, out attribute);
        if (!exist)
            attribute = new();
        attribute.Key = data.Key;
        attribute.Name = data.Name;
        attribute.Description = data.Description != null ? data.Description : attribute.Description;
        attribute.IsFiltered = data.isFiltered != null ? (bool)data.isFiltered : attribute.IsFiltered;

        bool success;
        if (exist)
            success = _provider.TryPatchAttribute(groupId, attribute);
        else
            success = _provider.TryAddAttribute(groupId, attribute);
        if (success)
            return Ok();
        else
            return exist ? BadRequest(new { error = $"Can't patch attribute with key: {data.Key}" }) : BadRequest(new { error = $"Can't create attribute with key: {data.Key}" });
    }
}