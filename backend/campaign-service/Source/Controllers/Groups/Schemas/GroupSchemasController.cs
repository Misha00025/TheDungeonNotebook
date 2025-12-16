using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/schemas")]
public class GroupSchemasController : GroupsBaseController
{
    private SchemasProvider _provider;

    public GroupSchemasController(GroupContext context, SchemasProvider provider) : base(context)
    {
        _provider = provider;
    }

    private ActionResult GetSchema(int groupId, string type)
    {
        if (TryGetGroup(groupId, out _))
        {
            var schema = _provider.GetSchema(groupId, type);
            if (schema == null)
                return NotFound($"Schema for {type} not found");
            return Ok(schema.ToResponse());   
        }
        return NotFound("Group not found");
    }
    
    private ActionResult PutSchema(int groupId, string type, SchemaPostData data)
    {
        if (TryGetGroup(groupId, out _)){
            var schema = data.AsSchema(type);
            var ok = _provider.TrySaveSchema(groupId, schema);
            if (ok == false)
                return BadRequest($"Can't save schema for {type}");
            return Ok(schema.ToResponse());
        }
        return NotFound("Group not found");
    }

    [HttpGet("skills")]
    public ActionResult GetSkillsSchema(int groupId)
    {
        return GetSchema(groupId, "skills");
    }
    
    [HttpPut("skills")]
    public ActionResult PutSkillsSchema(int groupId, SchemaPostData data)
    {
        return PutSchema(groupId, "skills", data);
    }
    
    [HttpGet("items")]
    public ActionResult GetItemsSchema(int groupId)
    {
        return GetSchema(groupId, "items");
    }
    
    [HttpPut("items")]
    public ActionResult PutItemsSchema(int groupId, SchemaPostData data)
    {
        return PutSchema(groupId, "items", data);
    }
}