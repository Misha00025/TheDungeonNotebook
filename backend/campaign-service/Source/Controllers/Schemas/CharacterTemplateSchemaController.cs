using Microsoft.AspNetCore.Mvc;
using Tdn.Models.Providing;
using Tdn.Models.DTOs;
using Tdn.Models.Schemas;
using Tdn.Models.Schemas.Templates;
using Tdn.Models.Schemas.Templates.Conversion;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("schemas/groups/{groupId}/template")]
public class CharacterTemplateSchemaController : BaseController
{
    private GenericMongoProvider<TemplateSchemaMongoData> _provider;
    private GroupAccessHelper _accessHelper;

    public CharacterTemplateSchemaController(GenericMongoProvider<TemplateSchemaMongoData> provider, GroupAccessHelper accessHelper)
    {
        _provider = provider;
        _accessHelper = accessHelper;
    }

    private static CategorySchemaMongoData AsData(CategorySchemaPostData category) => new()
    {
        Name = category.Name,
        Fields = category.Fields,
        Categories = category.Categories?.Select(AsData).ToList()
    };

    private static TemplateSchemaMongoData AsData(int groupId, TemplateSchemaPostData template) => new()
    {
        GroupId = groupId,
        Type = "template",
        Categories = template.Categories.Select(AsData).ToList()
    };
    
    [HttpGet]
    public ActionResult GetSchema(int groupId, [FromQuery] int? userId = null)
    {
        if (userId != null && !_accessHelper.HasGroupAccess(groupId, userId.Value))
            return NotFound();
        var schema = _provider.GetSchema(groupId);
        if (schema != null)
            return Ok(schema.ToResponse());
        return NotFound("Group not found");
    }
    
    [HttpPut]
    public ActionResult PutSchema(int groupId, TemplateSchemaPostData data, [FromQuery] int? userId = null)
    {
        if (userId != null && !_accessHelper.IsAdmin(groupId, userId.Value))
            return Forbidden();
        var mongoData = AsData(groupId, data);
        var ok = _provider.TrySaveSchema(groupId, mongoData);
        var schema = _provider.GetSchema(groupId);
        return schema != null && ok ? Ok(schema.ToResponse()) : BadRequest();
    }
}
