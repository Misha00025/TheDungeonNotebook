using Microsoft.AspNetCore.Mvc;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/characters/templates")]
public class TemplatesController : GroupsBaseController
{
    public struct FieldPostData
    {
        public string Name { get; set; } 
        public string Description { get; set; }
        public int Value { get; set; }
    }

    public struct CharlistPostData
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public Dictionary<string, FieldPostData>? Fields { get; set; }
    }

    private EntityContext _dbContext;
    private MongoDbContext _mongo;

    public TemplatesController(EntityContext context, MongoDbContext mongo, GroupContext groupContext) : base(groupContext)
    {
        _dbContext = context;
        _mongo = mongo;
    }
    
    [HttpGet]
    public ActionResult GetAll(int groupId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var charlistSet = _dbContext.Set<CharlistData>();
            var charlists = charlistSet.Where(e => e.GroupId == groupId).Select(e => e.ToDict(_mongo.GetEntity<CharlistMongoData>(MongoCollections.Templates, e.UUID)));
            return Ok(new Dictionary<string, object>() { {"templates", charlists} });
        }
        return NotFound("Group not found");
        
    }
    
    [HttpPost]
    public ActionResult PostTemplate(int groupId, CharlistPostData data)
    {
        if (TryGetGroup(groupId, out var _))
        {
            if (data.Name == null)
                return BadRequest("Name must be not null");
            if (data.Description == null)
                data.Description = "";
            if (data.Fields == null)
                data.Fields = new();
            var mongoItem = new CharlistMongoData()
            {
                Name = data.Name,
                Description = data.Description,
                Fields = new() // TODO: Continue me please
            };
            return NotImplemented();
        }
        return NotFound("Group not found");
    }
    
    [HttpGet("{templateId}")]
    public ActionResult GetTemplate(int groupId, int templateId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            
        }
        return NotFound("Group not found");
    }
}