using Microsoft.AspNetCore.Mvc;
using Tdn.Models.Providing;
using Tdn.Models.Schemas.Items;
using Tdn.Models.Schemas.Items.Conversion;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("schemas/groups/{groupId}")]
public class GroupSchemasController : BaseController
{
    private GroupSchemasProvider _provider;
    private GroupAccessHelper _accessHelper;

    public GroupSchemasController(GroupSchemasProvider provider, GroupAccessHelper accessHelper)
    {
        _provider = provider;
        _accessHelper = accessHelper;
    }

    private ActionResult GetSchema(int groupId, string type)
    {
        var schema = _provider.GetSchema(groupId, type);
        if (schema == null)
            return NotFound($"Schema for {type} not found");
        return Ok(schema.ToResponse());   
    }
    
    private ActionResult PutSchema(int groupId, string type, SchemaPostData data)
    {
        var schema = data.AsSchema(type);
        var ok = _provider.TrySaveSchema(groupId, schema);
        if (ok == false)
            return BadRequest($"Can't save schema for {type}");
        return Ok(schema.ToResponse());
    }

    [HttpGet("skills")]
    public ActionResult GetSkillsSchema(int groupId, [FromQuery] int? userId = null)
    {
        if (userId != null && !_accessHelper.HasGroupAccess(groupId, userId.Value))
            return NotFound();
        return GetSchema(groupId, "skills");
    }
    
    [HttpPut("skills")]
    public ActionResult PutSkillsSchema(int groupId, SchemaPostData data, [FromQuery] int? userId = null)
    {
        if (userId != null && !_accessHelper.IsAdmin(groupId, userId.Value))
            return Forbidden();
        return PutSchema(groupId, "skills", data);
    }
    
    [HttpGet("items")]
    public ActionResult GetItemsSchema(int groupId, [FromQuery] int? userId = null)
    {
        if (userId != null && !_accessHelper.HasGroupAccess(groupId, userId.Value))
            return NotFound();
        return GetSchema(groupId, "items");
    }
    
    [HttpPut("items")]
    public ActionResult PutItemsSchema(int groupId, SchemaPostData data, [FromQuery] int? userId = null)
    {
        if (userId != null && !_accessHelper.IsAdmin(groupId, userId.Value))
            return Forbidden();
        return PutSchema(groupId, "items", data);
    }
}
