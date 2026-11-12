using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models.Access;
using Tdn.Models.Providing;
using Tdn.Models.DTOs;
using Tdn.Models.Schemas;
using Tdn.Models.Schemas.Templates;
using Tdn.Models.Schemas.Templates.Conversion;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("schemas/groups/{groupId}/template")]
public class CharacterTemplateSchemaController : GroupsBaseController
{
    private GenericMongoProvider<TemplateSchemaMongoData> _provider;

    public CharacterTemplateSchemaController(
        CampaignContext context,
        GenericMongoProvider<TemplateSchemaMongoData> provider,
        SubjectAccessHelper subjectAccessHelper,
        ILogger<GroupsBaseController> logger) : base(context, subjectAccessHelper, logger)
    {
        _provider = provider;
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
    public ActionResult GetSchema(int groupId)
    {
        if (!CheckGroupAccess(groupId))
            return NotFound();
        var schema = _provider.GetSchema(groupId);
        if (schema != null)
            return Ok(schema.ToResponse());
        return NotFound("Group not found");
    }
    
    [HttpPut]
    public ActionResult PutSchema(int groupId, TemplateSchemaPostData data)
    {
        if (!SubjectAccess.IsAdmin(groupId))
            return Forbidden();
        var mongoData = AsData(groupId, data);
        var ok = _provider.TrySaveSchema(groupId, mongoData);
        var schema = _provider.GetSchema(groupId);
        return schema != null && ok ? Ok(schema.ToResponse()) : BadRequest();
    }
}
