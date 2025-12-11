using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;
using Tdn.Models;
using Tdn.Models.Conversions;

namespace Tdn.Api.Controllers;

[ApiController]
[Route("groups/{groupId}/items")]
public class GroupItemsController : GroupsBaseController
{
    public struct ItemPostData
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public int? Price { get; set; }
        public List<AttributePostData>? Attributes { get; set; }
        public bool? IsSecret { get; set; }
    }

    private EntityContext _dbContext;
    private MongoDbContext _mongo;
    
    public GroupItemsController(EntityContext context, MongoDbContext mongo, GroupContext groupContext) : base(groupContext)
    {
        _dbContext = context;
        _mongo = mongo;
    }

    [HttpGet]
    public ActionResult GetAll(int groupId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var items = _dbContext.Set<ItemData>().Where(e => e.GroupId == groupId);
            var result = items.Select(e => e.ToDict(_mongo.GetEntity<ItemMongoData>(MongoCollections.Items, e.UUID))).ToList();
            return Ok(new Dictionary<string, object>(){{"items", result}});
        }
        return NotFound("Group not found");
    }
    
    [HttpPost]
    public ActionResult PostItem(int groupId, [FromBody] ItemPostData data)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var mongoItem = new ItemMongoData()
            {
                Name = data.Name,
                Description = data.Description,
                Price = data.Price != null ? (int)data.Price : 0
            };
            _mongo.GetCollection<ItemMongoData>(MongoCollections.Items).InsertOne(mongoItem);
            var item = new ItemData()
            {
                GroupId = groupId,
                UUID = mongoItem.Id.ToString()
            };
            _dbContext.Add(item);
            _dbContext.SaveChanges();
            return Created($"groups/{groupId}/items/{item.Id}", item.ToDict(mongoItem));
        }
        return NotFound("Group not found");
    }
    
    [HttpGet("{itemId}")]
    public ActionResult GetItem(int groupId, int itemId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var item = _dbContext.Set<ItemData>().Where(e => e.GroupId == groupId && e.Id == itemId).FirstOrDefault();
            if (item == null)
                return NotFound("Item not found");
            var result = item.ToDict(_mongo.GetEntity<ItemMongoData>(MongoCollections.Items, item.UUID));
            return Ok(result);
        }
        return NotFound("Group not found");
    }
    
    [HttpPut("{itemId}")]
    public ActionResult PutItem(int groupId, int itemId, [FromBody] ItemPostData data)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var item = _dbContext.Set<ItemData>().Where(e => e.GroupId == groupId && e.Id == itemId).FirstOrDefault();
            if (item == null)
                return NotFound("Item not found");
            var mongoItem = _mongo.GetEntity<ItemMongoData>(MongoCollections.Items, item.UUID);
            if (mongoItem == null)
                return PostItem(groupId, data);
            mongoItem.Name = data.Name;
            mongoItem.Description = data.Description;
            mongoItem.Price = data.Price != null ? (int)data.Price : mongoItem.Price;
            var filter = Builders<ItemMongoData>.Filter.Eq("_id", mongoItem.Id);
            _mongo.GetCollection<ItemMongoData>(MongoCollections.Items).ReplaceOne(filter, mongoItem);
            return Ok(item.ToDict(mongoItem));
        }
        return NotFound("Group not found");
    }
    
    [HttpDelete("{itemId}")]
    public ActionResult DeleteItem(int groupId, int itemId)
    {
        if (TryGetGroup(groupId, out var _))
        {
            var item = _dbContext.Set<ItemData>().Where(e => e.GroupId == groupId && e.Id == itemId).FirstOrDefault();
            if (item == null)
                return NotFound("Item not found");
            var mongoItem = _mongo.GetEntity<ItemMongoData>(MongoCollections.Items, item.UUID);
            _dbContext.Remove(item);
            _dbContext.SaveChanges();
            var filter = Builders<ItemMongoData>.Filter.Eq("_id", mongoItem?.Id);
            _mongo.GetCollection<ItemMongoData>(MongoCollections.Items).DeleteOne(filter);
            return Ok(item.ToDict(mongoItem));
        }
        return NotFound("Group not found");
    }
}