using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}")]
public class ExportImportController : GroupsBaseController
{
    private readonly ExportImportProvider _provider;
    private readonly ILogger<ExportImportController> _logger;

    public ExportImportController(
        GroupContext groupContext,
        GroupAccessHelper accessHelper,
        ExportImportProvider provider,
        ILogger<ExportImportController> logger)
        : base(groupContext, accessHelper)
    {
        _provider = provider;
        _logger = logger;
    }

    [HttpGet("export")]
    public ActionResult Export(int groupId,
        [FromQuery] string include = "templates,characters,items,skills",
        [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.IsAdmin(groupId, userId.Value))
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
        [FromQuery] string include = "templates,characters,items,skills",
        [FromQuery] int? userId = null)
    {
        if (userId != null && !AccessHelper.IsAdmin(groupId, userId.Value))
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
