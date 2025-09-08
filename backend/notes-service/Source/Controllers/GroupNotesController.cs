using Microsoft.AspNetCore.Mvc;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("/groups/{groupId}/notes")]
public class GroupNotesController : BaseController<GroupNoteData>
{
    public GroupNotesController(MongoDbContext mongo) : base(mongo)
    {
    }

    protected override string CollectionName => "group_notes";
}