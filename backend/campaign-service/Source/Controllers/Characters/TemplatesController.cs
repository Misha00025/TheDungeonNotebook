using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

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
        public string? Formula { get; set; }
        public string? ModifierFormula { get; set; }
    }

    

    public struct TemplatePostData
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public Dictionary<string, FieldPostData> Fields { get; set; }
    }

    private IMongoDbContext _mongo;

    public TemplatesController(CampaignContext context, IMongoDbContext mongo, GroupAccessHelper accessHelper) : base(context, accessHelper)
    {
        _mongo = mongo;
    }
    
    private FieldMongoData CreateFieldMongoData(FieldPostData data)
    {
        FieldMongoData field;

        if (data.MaxValue != null)
            field = new PropertyMongoData() { MaxValue = (int)data.MaxValue };
        else if (data.ModifierFormula != null)
            field = new ModifiedFieldMongoData() { ModifierFormula = data.ModifierFormula };
        else
            field = new FieldMongoData();
        field.Name = data.Name;
        field.Description = data.Description;
        field.Value = data.Value;
        field.Formula = string.IsNullOrEmpty(data.Formula) ? "" : data.Formula;
        return field;
    }
    
    private IMongoCollection<TemplateMongoData> GetCollection() =>  _mongo.GetCollection<TemplateMongoData>(MongoCollections.Templates);
    
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
            var templateSet = DbContext.Set<TemplateData>();
            var templates = templateSet.Where(e => e.GroupId == groupId).Select(e => e.ToDict(_mongo.GetEntity<TemplateMongoData>(MongoCollections.Templates, e.UUID)));
            return Ok(new Dictionary<string, object>() { {"templates", templates} });
        }
        return NotFound("Group not found");
        
    }
    
    [HttpPost]
    public ActionResult PostTemplate(int groupId, [FromBody] TemplatePostData data)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var templateSet = DbContext.Set<TemplateData>();
            var template = templateSet.Where(e => e.GroupId == groupId).FirstOrDefault();
            if (template != null)
                return Conflict("Template already exist");
            var mongoItem = new TemplateMongoData()
            {
                Name = data.Name,
                Description = data.Description,
                Fields = Convert(data.Fields),
            };
            var set = DbContext.Set<TemplateData>();
            var collection = GetCollection();
            collection.InsertOne(mongoItem);
            template = new TemplateData()
            {
                UUID = mongoItem.Id.ToString(),
                GroupId = groupId
            };
            set.Add(template);
            try
            {
                DbContext.SaveChanges();
            }
            catch
            {
		        var filter = Builders<TemplateMongoData>.Filter.Eq("_id", mongoItem.Id);
                collection.DeleteOne(filter);
                throw new Exception($"Can't create template");
            }
            return Created($"/groups/{groupId}/characters/templates/{template.Id}", template.ToDict(mongoItem));
        }
        return NotFound("Group not found");
    }
    
    [HttpGet("{templateId}")]
    public ActionResult GetTemplate(int groupId, int templateId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var templateSet = DbContext.Set<TemplateData>();
            var template = templateSet.Where(e => e.GroupId == groupId).FirstOrDefault();
            if (template == null)
                return NotFound("Template not found");
            return Ok(template.ToDict(_mongo.GetEntity<TemplateMongoData>(MongoCollections.Templates, template.UUID)));
        }
        return NotFound("Group not found");
    }
    
    [HttpPut]
    [HttpPut("{templateId}")]
    public ActionResult PutTemplate(int groupId, int templateId, [FromBody] TemplatePostData data)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var templateSet = DbContext.Set<TemplateData>();
            var template = templateSet.Where(e => e.GroupId == groupId).FirstOrDefault();
            TemplateMongoData? mongoData;
            if (template == null)
                return NotFound("Template not found");
            mongoData = _mongo.GetEntity<TemplateMongoData>(MongoCollections.Templates, template.UUID);
            if (mongoData == null)
                return NotFound("Template document not found");
            mongoData.Name = data.Name;
            mongoData.Description = data.Description;
            mongoData.Fields = Convert(data.Fields);
            var collection = GetCollection();
		    var filter = Builders<TemplateMongoData>.Filter.Eq("_id", mongoData.Id);
            collection.ReplaceOne(filter, mongoData);
            return Ok(template.ToDict(mongoData));
        }
        return NotFound("Group not found");
    }
}