using Microsoft.AspNetCore.Mvc;
using Tdn.Models.Access;
using Tdn.Models.Conversions;
using Tdn.Models.DTOs;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("systems")]
public class SystemsController : BaseController
{
    private readonly SystemProvider _provider;
    private readonly SystemAccessHelper _accessHelper;

    public SystemsController(SystemProvider provider, SystemAccessHelper accessHelper)
    {
        _provider = provider;
        _accessHelper = accessHelper;
    }

    [HttpGet]
    public ActionResult GetAll()
    {
        var systems = _provider.GetAll();
        return Ok(systems.Select(e => e.ToDict()));
    }

    [HttpPost]
    public ActionResult PostSystem(SystemPostData data)
    {
        if (string.IsNullOrEmpty(data.Name))
            return Unprocessable("Name is required");
        var system = _provider.Create(data.Name, data.Description, data.Icon);
        return Created($"systems/{system.Id}", system.ToDict());
    }

    [HttpGet("{systemId}")]
    public ActionResult GetSystem(string systemId)
    {
        var system = _provider.Get(systemId);
        if (system == null) return NotFound();
        return Ok(system.ToDict());
    }

    [HttpPatch("{systemId}")]
    public ActionResult PatchSystem(string systemId, SystemPatchData data)
    {
        if (data.Name == null && data.Description == null && data.Icon == null)
            return BadRequest();
        var system = _provider.Update(systemId, data.Name, data.Description, data.Icon);
        if (system == null) return NotFound();
        return Ok(system.ToDict());
    }

    [HttpDelete("{systemId}")]
    public ActionResult DeleteSystem(string systemId)
    {
        var system = _provider.Delete(systemId);
        if (system == null) return NotFound();
        return Ok(system.ToDict());
    }
}
