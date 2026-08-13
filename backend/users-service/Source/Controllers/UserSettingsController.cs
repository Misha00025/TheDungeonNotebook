using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Tdn.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("users/{userId}/settings")]
public class UserSettingsController : BaseController
{
    private readonly UserSettingsProvider _provider;

    public UserSettingsController(UserSettingsProvider provider)
    {
        _provider = provider;
    }

    [HttpGet]
    public ActionResult Get([FromRoute] int userId, [FromQuery(Name = "keys")] string? keys = null)
    {
        var selected = ParseKeys(keys);
        var values = _provider.Get(userId, selected);
        return Ok(new Dictionary<string, object?>
        {
            { "settings", SettingsJsonHelper.ToJsonMap(values) }
        });
    }

    [HttpPut]
    public ActionResult Put([FromRoute] int userId, [FromBody] JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
            return BadRequest("Settings must be a JSON object");
        _provider.Save(userId, SettingsJsonHelper.ToBsonMap(body));
        var all = _provider.Get(userId, null);
        return Ok(new Dictionary<string, object?>
        {
            { "settings", SettingsJsonHelper.ToJsonMap(all) }
        });
    }

    [HttpDelete]
    public ActionResult Delete([FromRoute] int userId, [FromQuery(Name = "keys")] string? keys = null)
    {
        var selected = ParseKeys(keys);
        if (selected == null)
            return BadRequest("Keys are required for deletion");
        _provider.Delete(userId, selected);
        var rest = _provider.Get(userId, null);
        return Ok(new Dictionary<string, object?>
        {
            { "settings", SettingsJsonHelper.ToJsonMap(rest) }
        });
    }

    private static IEnumerable<string>? ParseKeys(string? keys)
    {
        if (string.IsNullOrWhiteSpace(keys))
            return null;
        var parsed = keys.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parsed.Length == 0 ? null : (IEnumerable<string>)parsed;
    }
}
