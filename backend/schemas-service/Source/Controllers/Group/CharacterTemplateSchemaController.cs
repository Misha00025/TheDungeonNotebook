using Microsoft.AspNetCore.Mvc;
using Tdn.Models.Groups.Items;
using Tdn.Models.Groups.Templates;
using Tdn.Models.Groups.Templates.Conversion;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("schemas/groups/{groupId}/template")]
public class CharacterTemplateSchemaController : ControllerBase
{
    private CharacterTemplateSchemaProvider _provider;

    public CharacterTemplateSchemaController(CharacterTemplateSchemaProvider provider)
    {
        _provider = provider;
    }
    
    [HttpGet]
    public ActionResult GetSchema(int groupId)
    {
        var schema = _provider.GetSchema(groupId);
        if (schema != null)
            return Ok(schema.ToResponse());
        return NotFound("Group not found");
    }
    
    [HttpPut]
    public ActionResult PutSchema(int groupId, TemplateSchemaPostData data)
    {
        var ok = _provider.TrySaveSchema(groupId, data);
        var schema = _provider.GetSchema(groupId);
        return schema != null && ok ? Ok(schema.ToResponse()) : BadRequest();
    }
}