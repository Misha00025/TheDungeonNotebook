using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;
using Tdn.Models.DTOs;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("systems/{systemId}/versions")]
public class SystemVersionsController : BaseController
{
    private readonly SystemProvider _provider;
    private readonly SnapshotProvider _snapshotProvider;

    public SystemVersionsController(SystemProvider provider, SnapshotProvider snapshotProvider)
    {
        _provider = provider;
        _snapshotProvider = snapshotProvider;
    }

    [HttpGet]
    public ActionResult GetVersions(string systemId)
    {
        var versions = _provider.GetVersions(systemId);
        return Ok(versions.Select(e => e.ToDict()));
    }

    [HttpPost]
    public ActionResult PostVersion(string systemId, VersionPostData data)
    {
        if (string.IsNullOrEmpty(data.Version))
            return Unprocessable("Version is required");

        var content = ToContentData(data.Content);
        var version = _provider.CreateVersion(systemId, data.Version, content);
        if (version == null)
            return Unprocessable("Version already exists or system not found");
        return Created($"systems/{systemId}/versions/{version.Id}", version.ToDict());
    }

    [HttpGet("{versionId}")]
    public ActionResult GetVersion(string systemId, string versionId)
    {
        var version = _provider.GetVersion(systemId, versionId);
        if (version == null) return NotFound();
        return Ok(version.ToDict());
    }

    [HttpGet("{versionId}/snapshot")]
    public ActionResult GetSnapshot(string systemId, string versionId)
    {
        var version = _provider.GetVersion(systemId, versionId);
        if (version == null) return NotFound();
        var snapshot = _snapshotProvider.GetSnapshot(version.SnapshotId);
        if (snapshot == null) return NotFound();
        return Ok(snapshot.ToDict());
    }

    private static SnapshotContentData ToContentData(SnapshotContentPostData data)
    {
        return new SnapshotContentData
        {
            Items = data.Items.Select(ToItemData).ToList(),
            Skills = data.Skills.Select(ToItemData).ToList(),
            CharacterTemplate = data.CharacterTemplate == null ? null : new SnapshotCharacterTemplateData
            {
                Fields = data.CharacterTemplate.Fields.Select(f => new SnapshotTemplateFieldData
                {
                    Key = f.Key,
                    Label = f.Label,
                    Type = f.Type,
                    Formula = f.Formula
                }).ToList()
            }
        };
    }

    private static SnapshotContentItemData ToItemData(SnapshotContentItemPostData data)
    {
        return new SnapshotContentItemData
        {
            Id = string.IsNullOrEmpty(data.Id) ? Guid.NewGuid().ToString() : data.Id,
            Name = data.Name,
            Description = data.Description,
            Properties = JsonElementConverter.ToPlain(data.Properties),
            Price = data.Price ?? 0,
            Rarity = data.Rarity
        };
    }
}
