using Microsoft.AspNetCore.Mvc;
using Tdn.Models.Providing;
using Tdn.Models.Schemas.Characters;
using Tdn.Models.Schemas.Characters.Conversion;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("schemas/groups/{groupId}/characters/resources")]
public class CharacterResourcesSchemaController : BaseController
{
    private CharacterResourcesSchemaProvider _provider;
    private GroupAccessHelper _accessHelper;

    public CharacterResourcesSchemaController(CharacterResourcesSchemaProvider provider, GroupAccessHelper accessHelper)
    {
        _provider = provider;
        _accessHelper = accessHelper;
    }
    
    [HttpGet]
    public ActionResult GetSchema(int groupId, [FromQuery] int? userId = null)
    {
        if (userId != null && !_accessHelper.HasGroupAccess(groupId, userId.Value))
            return NotFound();
        var mongoData = _provider.GetSchema(groupId);
        var schema = mongoData != null
            ? new CharacterResourcesSchema { Fields = mongoData.Fields }
            : new CharacterResourcesSchema();
        return Ok(schema.ToResponse());
    }
    
    [HttpPut]
    public ActionResult PutSchema(int groupId, CharacterResourcesPostData data, [FromQuery] int? userId = null)
    {
        if (userId != null && !_accessHelper.IsAdmin(groupId, userId.Value))
            return Forbidden();
        var schema = data.AsModel();
        var ok = _provider.TrySaveSchema(groupId, schema);
        return ok ? Ok(schema.ToResponse()) : BadRequest();
    }
}
