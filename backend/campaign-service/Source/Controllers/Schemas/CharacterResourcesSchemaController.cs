using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models.Access;
using Tdn.Models.Providing;
using Tdn.Models.DTOs;
using Tdn.Models.Schemas;
using Tdn.Models.Schemas.Characters;
using Tdn.Models.Schemas.Characters.Conversion;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("schemas/groups/{groupId}/characters/resources")]
public class CharacterResourcesSchemaController : GroupsBaseController
{
    private GenericMongoProvider<CharacterResourcesMongoData> _provider;

    public CharacterResourcesSchemaController(
        CampaignContext context,
        GenericMongoProvider<CharacterResourcesMongoData> provider,
        SubjectAccessHelper subjectAccessHelper,
        ILogger<GroupsBaseController> logger) : base(context, subjectAccessHelper, logger)
    {
        _provider = provider;
    }
    
    [HttpGet]
    public ActionResult GetSchema(int groupId)
    {
        if (!CheckGroupAccess(groupId))
            return NotFound();
        var mongoData = _provider.GetSchema(groupId);
        var schema = mongoData != null
            ? new CharacterResourcesSchema { Fields = mongoData.Fields }
            : new CharacterResourcesSchema();
        return Ok(schema.ToResponse());
    }
    
    [HttpPut]
    public ActionResult PutSchema(int groupId, CharacterResourcesPostData data)
    {
        if (!SubjectAccess.IsAdmin(groupId))
            return Forbidden();
        var schema = data.AsModel();
        var mongoData = new CharacterResourcesMongoData
        {
            GroupId = groupId,
            Type = "characters",
            Fields = schema.Fields
        };
        var ok = _provider.TrySaveSchema(groupId, mongoData);
        return ok ? Ok(schema.ToResponse()) : BadRequest();
    }
}
