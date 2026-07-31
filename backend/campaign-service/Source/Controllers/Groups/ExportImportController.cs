using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;
using Tdn.Models.Access;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}")]
public class ExportImportController : GroupsBaseController
{
    private readonly ExportImportProvider _provider;
    private readonly ILogger<ExportImportController> _logger;

    public ExportImportController(
        CampaignContext groupContext,
        SubjectAccessHelper subjectAccessHelper,
        ExportImportProvider provider,
        ILogger<ExportImportController> logger,
        ILogger<GroupsBaseController> baseLogger)
        : base(groupContext, subjectAccessHelper, baseLogger)
    {
        _provider = provider;
        _logger = logger;
    }

    [HttpGet("export")]
    public ActionResult Export(int groupId,
        [FromQuery] string include = "templates,characters,items,skills")
    {
        if (!SubjectAccess.IsAdmin(groupId))
            return Forbidden();

        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");

        var includeSet = ParseInclude(include);
        var exportData = _provider.BuildExport(groupId, includeSet);
        return Ok(exportData);
    }

    [HttpPost("import")]
    public ActionResult Import(int groupId,
        [FromBody] ExportData data,
        [FromQuery] string include = "templates,characters,items,skills")
    {
        if (!SubjectAccess.IsAdmin(groupId))
            return Forbidden();

        if (!TryGetGroup(groupId, out var _))
            return NotFound("Group not found");

        var includeSet = ParseInclude(include);
        var result = _provider.Import(groupId, data, includeSet);

        if (result.Success)
            return Ok(result);
        else
            return BadRequest(result);
    }

    private static HashSet<string> ParseInclude(string include)
    {
        if (string.IsNullOrWhiteSpace(include))
            return new HashSet<string> { "templates", "characters", "items", "skills" };

        return include.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => s.ToLowerInvariant())
            .ToHashSet();
    }
}
