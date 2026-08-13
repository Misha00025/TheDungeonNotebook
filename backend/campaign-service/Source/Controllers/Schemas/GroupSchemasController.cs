using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models.Access;
using Tdn.Models.Providing;
using Tdn.Models.DTOs;
using Tdn.Models.Schemas;
using Tdn.Models.Schemas.Items;
using Tdn.Models.Schemas.Items.Conversion;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("schemas/groups/{groupId}")]
public class GroupSchemasController : GroupsBaseController
{
    private GenericMongoProvider<SkillsSchemaMongoData> _skillsProvider;
    private GenericMongoProvider<ItemsSchemaMongoData> _itemsProvider;

    public GroupSchemasController(
        CampaignContext context,
        GenericMongoProvider<SkillsSchemaMongoData> skillsProvider,
        GenericMongoProvider<ItemsSchemaMongoData> itemsProvider,
        SubjectAccessHelper subjectAccessHelper,
        ILogger<GroupsBaseController> logger) : base(context, subjectAccessHelper, logger)
    {
        _skillsProvider = skillsProvider;
        _itemsProvider = itemsProvider;
    }

    private static Schema AsSchema(SchemaMongoData data) => new()
    {
        Type = data.Type,
        GroupingAttributes = data.GroupingAttributes
    };

    private static T AsData<T>(int groupId, Schema schema) where T : SchemaMongoData, new() => new T()
    {
        GroupId = groupId,
        Type = schema.Type,
        GroupingAttributes = schema.GroupingAttributes
    };

    [HttpGet("skills")]
    public ActionResult GetSkillsSchema(int groupId)
    {
        if (!CheckGroupAccess(groupId))
            return NotFound();
        var mongoData = _skillsProvider.GetSchema(groupId);
        if (mongoData == null)
            return NotFound("Schema for skills not found");
        return Ok(AsSchema(mongoData).ToResponse());
    }
    
    [HttpPut("skills")]
    public ActionResult PutSkillsSchema(int groupId, SchemaPostData data)
    {
        if (!SubjectAccess.IsAdmin(groupId))
            return Forbidden();
        var schema = data.AsSchema("skills");
        var mongoData = AsData<SkillsSchemaMongoData>(groupId, schema);
        var ok = _skillsProvider.TrySaveSchema(groupId, mongoData);
        if (ok == false)
            return BadRequest("Can't save schema for skills");
        return Ok(schema.ToResponse());
    }
    
    [HttpGet("items")]
    public ActionResult GetItemsSchema(int groupId)
    {
        if (!CheckGroupAccess(groupId))
            return NotFound();
        var mongoData = _itemsProvider.GetSchema(groupId);
        if (mongoData == null)
            return NotFound("Schema for items not found");
        return Ok(AsSchema(mongoData).ToResponse());
    }
    
    [HttpPut("items")]
    public ActionResult PutItemsSchema(int groupId, SchemaPostData data)
    {
        if (!SubjectAccess.IsAdmin(groupId))
            return Forbidden();
        var schema = data.AsSchema("items");
        var mongoData = AsData<ItemsSchemaMongoData>(groupId, schema);
        var ok = _itemsProvider.TrySaveSchema(groupId, mongoData);
        if (ok == false)
            return BadRequest("Can't save schema for items");
        return Ok(schema.ToResponse());
    }
}
