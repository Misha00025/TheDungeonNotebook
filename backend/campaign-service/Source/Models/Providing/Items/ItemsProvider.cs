using Microsoft.EntityFrameworkCore;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class ItemsProvider
{
    private const string ITEMS_COLLECTION_NAME = "skills";
    
    private ItemsContext _sql;
    private MongoDbContext _mongo;
    private AttributesProvider _attributes;
    private ILogger<ItemsProvider> _logger;

    public ItemsProvider(ItemsContext context, MongoDbContext mongoDbContext, AttributesProvider attributesProvider, ILogger<ItemsProvider> logger)
    {
        _sql = context;
        _mongo = mongoDbContext;
        _attributes = attributesProvider;
        _logger = logger;
    }

    private static Group ToGroup(GroupData data) => new()
    {
        Id = data.Id,
        Name = data.Name,
        Description = data.Name
    };
    
    private ValuedAttribute ToAttribute(int groupId, ValuedAttributeMongoData data)
    {
        Attribute attribute;
        if (!_attributes.TryGetAttribute(groupId, data.Key, out attribute))
            attribute = new()
            {
                Key = data.Key,
                Name = data.Key,
            };
    
        return new()
        {
            Key = attribute.Key,
            Name = attribute.Name,
            Description = attribute.Description,
            Value = data.Value
        };
    }
    
    private Item ToItem(ItemData data, ItemMongoData mongoData)
    {
        var group = ToGroup(data.Group);
        var item = new Item(group);
        item.Id = data.Id;
        item.Name = mongoData.Name;
        item.Description = mongoData.Description;
        item.Price = mongoData.Price;
        item.Attributes = mongoData.Attributes.Select(e => ToAttribute(data.GroupId, e)).ToList();
        item.IsSecret = mongoData.IsSecret;
        return item;
    }

    private Item GetItem(ItemData data)
    {
        var mongoData = _mongo.GetEntity<ItemMongoData>(ITEMS_COLLECTION_NAME, data.UUID);
        return ToItem(data, mongoData!);
    }

    public Item? GetItem(int groupId, int itemId)
    {
        var data = _sql.Items
                    .Where(e => e.GroupId == groupId && e.Id == itemId)
                    .Include(e => e.Group)
                    .FirstOrDefault();
        if (data == null)
            return null;
        return GetItem(data);
    }
    
    public IEnumerable<Item> GetItems(int groupId)
    {
        var skills = _sql.Items
                        .Where(e => e.GroupId == groupId)
                        .Include(e => e.Group)
                        .AsEnumerable()
                        .Select(GetItem)
                        .ToList();
        return skills;
    }
    
    public bool TryCreateItem(int groupId, Item item)
    {
        try
        {
            var mongoData = new ItemMongoData()
            {
                Name = item.Name,
                Description = item.Description,
                Price = item.Price,
                Attributes = item.Attributes
                    .Select(e => new ValuedAttributeMongoData()
                    {
                        Key = e.Key,
                        Value = e.Value
                    })
                    .ToList(),
                IsSecret = item.IsSecret
            };
            _mongo.GetCollection<ItemMongoData>(ITEMS_COLLECTION_NAME).InsertOne(mongoData);
            ItemData data = new ItemData() { GroupId = groupId, UUID = mongoData.Id.ToString() };
            _sql.Items.Add(data);
            _sql.SaveChanges();
            item.Id = data.Id;
            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error with create item: {e}");
            return false;
        }
    }
}