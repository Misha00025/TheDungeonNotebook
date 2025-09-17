using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
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
        public int? MaxValue { get; set; }
    }

    public struct CategorySchemaPostData
    {
        public string Key { get; set; }
        public string Name { get; set; }
        public List<string> Fields { get; set; }
    }

    public struct SchemaPostData
    {
        public List<CategorySchemaPostData> Categories { get; set; }
    }

    public struct CharlistPostData
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public Dictionary<string, FieldPostData> Fields { get; set; }
        public SchemaPostData? Schema { get; set; }
    }

    private EntityContext _dbContext;
    private MongoDbContext _mongo;

    public TemplatesController(EntityContext context, MongoDbContext mongo, GroupContext groupContext) : base(groupContext)
    {
        _dbContext = context;
        _mongo = mongo;
    }
    
    private FieldMongoData CreateFieldMongoData(FieldPostData data)
    {
    
        var field = data.MaxValue == null ?  
        new FieldMongoData()
        {
            Name = data.Name,
            Description = data.Description,
            Value = data.Value
        } : 
        new PropertyMongoData()
        {
            Name = data.Name,
            Description = data.Description,
            Value = data.Value,
            MaxValue = (int)data.MaxValue
        };
        return field;
    }
    
    private TemplateSchema ConvertSchema(SchemaPostData? schemaPost)
    {
        var schema = new TemplateSchema();
        if (schemaPost != null)
            schema.Categories = schemaPost.Value.Categories.Select(s => new CategorySchema
            {
                Key = s.Key,
                Name = s.Name,
                Fields = s.Fields
            }).ToList();
        return schema;
    }
    
    private IMongoCollection<CharlistMongoData> GetCollection() =>  _mongo.GetCollection<CharlistMongoData>(MongoCollections.Templates);
    
    private Dictionary<string, FieldMongoData> Convert(Dictionary<string, FieldPostData> fields)
    {
        return fields.Select(
                    e => new KeyValuePair<string, FieldMongoData>(e.Key, CreateFieldMongoData(e.Value)))
                    .ToDictionary();
    }
    
    [HttpGet]
    public ActionResult GetAll(int groupId)
    {
        if (TryGetGroup(groupId, out var group))
        {
            var charlistSet = _dbContext.Set<CharlistData>();
            var charlists = charlistSet.Where(e => e.GroupId == groupId).Select(e => e.ToDict(_mongo.GetEntity<CharlistMongoData>(MongoCollections.Templates, e.UUID)));
            return Ok(new Dictionary<string, object>() { {"templates", charlists} });
        }
        return NotFound("Group not found");
        
    }
    
    [HttpPost]
    public ActionResult PostTemplate(int groupId, [FromBody] CharlistPostData data)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var mongoItem = new CharlistMongoData()
            {
                Name = data.Name,
                Description = data.Description,
                Fields = Convert(data.Fields),
                Schema = ConvertSchema(data.Schema)
            };
            var set = _dbContext.Set<CharlistData>();
            var collection = GetCollection();
            collection.InsertOne(mongoItem);
            var charlist = new CharlistData()
            {
                UUID = mongoItem.Id.ToString(),
                GroupId = groupId
            };
            set.Add(charlist);
            try
            {
                _dbContext.SaveChanges();
            }
            catch
            {
		        var filter = Builders<CharlistMongoData>.Filter.Eq("_id", mongoItem.Id);
                collection.DeleteOne(filter);
                throw new Exception($"Can't create charlist");
            }
            return Created($"/groups/{groupId}/characters/templates/{charlist.Id}", charlist.ToDict(mongoItem));
        }
        return NotFound("Group not found");
    }
    
    [HttpGet("{templateId}")]
    public ActionResult GetTemplate(int groupId, int templateId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var charlistSet = _dbContext.Set<CharlistData>();
            var charlist = charlistSet.Where(e => e.GroupId == groupId && e.Id == templateId).FirstOrDefault();
            if (charlist == null)
                return NotFound("Template not found");
            return Ok(charlist.ToDict(_mongo.GetEntity<CharlistMongoData>(MongoCollections.Templates, charlist.UUID)));
        }
        return NotFound("Group not found");
    }
    
    [HttpPut("{templateId}")]
    public ActionResult PutTemplate(int groupId, int templateId, [FromBody] CharlistPostData data)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var charlistSet = _dbContext.Set<CharlistData>();
            var charlist = charlistSet.Where(e => e.GroupId == groupId && e.Id == templateId).FirstOrDefault();
            if (charlist == null)
                return NotFound("Template not found");
            var mongoData = _mongo.GetEntity<CharlistMongoData>(MongoCollections.Templates, charlist.UUID);
            if (mongoData == null)
                return NotFound("Template document not found");
            mongoData.Name = data.Name;
            mongoData.Description = data.Description;
            mongoData.Fields = Convert(data.Fields);
            mongoData.Schema = ConvertSchema(data.Schema);
            var collection = GetCollection();
		    var filter = Builders<CharlistMongoData>.Filter.Eq("_id", mongoData.Id);
            collection.ReplaceOne(filter, mongoData);
            return Ok(charlist.ToDict(mongoData));
        }
        return NotFound("Group not found");
    }
    
    [HttpDelete("{templateId}")]
    public ActionResult DeleteTemplate(int groupId, int templateId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var charlistSet = _dbContext.Set<CharlistData>();
            var charlist = charlistSet.Where(e => e.GroupId == groupId && e.Id == templateId).FirstOrDefault();
            if (charlist == null)
                return NotFound("Template not found");
            var mongoData = _mongo.GetEntity<CharlistMongoData>(MongoCollections.Templates, charlist.UUID);
            if (mongoData == null)
                return NotFound("Template document not found");
		    var filter = Builders<CharlistMongoData>.Filter.Eq("_id", mongoData.Id);
            _dbContext.Remove(charlist);
            _dbContext.SaveChanges();
            GetCollection().DeleteOne(filter);
            return Ok(charlist.ToDict(mongoData));
        }
        return NotFound("Group not found");
    }
}