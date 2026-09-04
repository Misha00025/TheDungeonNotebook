using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;
using Tdn.Models.DTOs;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

/// <summary>
/// CRUD контента внутри версии: предметы, навыки, шаблон персонажа.
/// Контент хранится в снимке (MongoDB). Замена коллекции = create/update/delete элементов.
/// </summary>
[ApiController]
[Route("systems/{systemId}/versions/{versionId}/content")]
public class SystemContentController : BaseController
{
    private readonly SystemProvider _provider;
    private readonly SnapshotProvider _snapshotProvider;

    public SystemContentController(SystemProvider provider, SnapshotProvider snapshotProvider)
    {
        _provider = provider;
        _snapshotProvider = snapshotProvider;
    }

    /// <summary>Получение контента версии (для sync-service).</summary>
    [HttpGet]
    public ActionResult GetContent(string systemId, string versionId)
    {
        var snapshot = GetSnapshot(systemId, versionId);
        if (snapshot == null) return NotFound();
        return Ok(snapshot.Content.ToDict());
    }

    /// <summary>Замена списка предметов версии.</summary>
    [HttpPut("items")]
    public ActionResult PutItems(string systemId, string versionId, List<SnapshotContentItemPostData> data)
    {
        var snapshot = GetSnapshot(systemId, versionId);
        if (snapshot == null) return NotFound();

        snapshot.Content.Items = data.Select(ToItemData).ToList();
        if (!_snapshotProvider.UpdateContent(snapshot.Id.ToString(), snapshot.Content))
            return NotFound();
        return Ok(snapshot.Content.ToDict());
    }

    /// <summary>Замена списка навыков версии.</summary>
    [HttpPut("skills")]
    public ActionResult PutSkills(string systemId, string versionId, List<SnapshotContentItemPostData> data)
    {
        var snapshot = GetSnapshot(systemId, versionId);
        if (snapshot == null) return NotFound();

        snapshot.Content.Skills = data.Select(ToItemData).ToList();
        if (!_snapshotProvider.UpdateContent(snapshot.Id.ToString(), snapshot.Content))
            return NotFound();
        return Ok(snapshot.Content.ToDict());
    }

    /// <summary>Замена шаблона персонажа версии.</summary>
    [HttpPut("character_template")]
    public ActionResult PutCharacterTemplate(string systemId, string versionId, SnapshotCharacterTemplatePostData data)
    {
        var snapshot = GetSnapshot(systemId, versionId);
        if (snapshot == null) return NotFound();

        snapshot.Content.CharacterTemplate = new SnapshotCharacterTemplateData
        {
            Fields = data.Fields.Select(f => new SnapshotTemplateFieldData
            {
                Key = f.Key,
                Label = f.Label,
                Type = f.Type,
                Formula = f.Formula
            }).ToList()
        };
        if (!_snapshotProvider.UpdateContent(snapshot.Id.ToString(), snapshot.Content))
            return NotFound();
        return Ok(snapshot.Content.ToDict());
    }

    private SnapshotData? GetSnapshot(string systemId, string versionId)
    {
        var version = _provider.GetVersion(systemId, versionId);
        if (version == null) return null;
        return _snapshotProvider.GetSnapshot(version.SnapshotId);
    }

    private static SnapshotContentItemData ToItemData(SnapshotContentItemPostData data)
    {
        return new SnapshotContentItemData
        {
            Id = string.IsNullOrEmpty(data.Id) ? Guid.NewGuid().ToString() : data.Id,
            Name = data.Name,
            Description = data.Description,
            Properties = data.Properties,
            Price = data.Price ?? 0,
            Rarity = data.Rarity
        };
    }
}
