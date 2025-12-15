using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class ItemsProvider
{
    private const string ITEMS_COLLECTION_NAME = "items";
    
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
    
    public Item? GetItem(int groupId, int itemId, int characterId)
    {
        var data = _sql.CharacterItems
                    .Include(e => e.Item)
                    .Where(e => e.Item.GroupId == groupId && e.ItemId == itemId && e.CharacterId == characterId)
                    .Include(e => e.Item.Group)
                    .FirstOrDefault();
        if (data == null)
            return null;
        var item = GetItem(data.Item);
        item.Amount = data.Amount;
        return item;
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
    
    public IEnumerable<Item> GetItems(int groupId, int characterId)
    {
        var skills = _sql.CharacterItems
                        .Include(e => e.Item)
                        .Include(e => e.Item.Group)
                        .Where(e => e.Item.GroupId == groupId && e.CharacterId == characterId)
                        .AsEnumerable()
                        .Select(e => {var item = GetItem(e.Item); item.Amount = e.Amount; return item;})
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
    
    public bool TryUpdateItem(Item item)
    {
        try
        {
            var itemData = _sql.Items
                .Include(e => e.Group)
                .FirstOrDefault(e => e.Id == item.Id && e.GroupId == item.Group.Id);
            
            if (itemData == null)
                return false;

            var mongoData = new ItemMongoData()
            {
                Id = new ObjectId(itemData.UUID),
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

            var collection = _mongo.GetCollection<ItemMongoData>(ITEMS_COLLECTION_NAME);
            var result = collection.ReplaceOne(
                Builders<ItemMongoData>.Filter.Eq(x => x.Id, new ObjectId(itemData.UUID)),
                mongoData);

            return result.IsAcknowledged && result.ModifiedCount > 0;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error with update item: {e}");
            return false;
        }
    }
    
    public bool TryDeleteItem(int groupId, int itemId)
    {
        try
        {
            var itemData = _sql.Items
                .FirstOrDefault(e => e.GroupId == groupId && e.Id == itemId);
            if (itemData == null)
                return false;
            var collection = _mongo.GetCollection<ItemMongoData>(ITEMS_COLLECTION_NAME);
            _sql.Items.Remove(itemData);
            _sql.SaveChanges();
            var mongoResult = collection.DeleteOne(Builders<ItemMongoData>.Filter.Eq(x => x.Id, new ObjectId(itemData.UUID)));
            return mongoResult.IsAcknowledged && mongoResult.DeletedCount > 0;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error with delete skill: {e}");
            return false;
        }
    }
    
    public bool TrySetItemToCharacter(Item item, int characterId, int amount)
    {
        try
        {
            var existing = _sql.CharacterItems
                .FirstOrDefault(e => e.CharacterId == characterId && e.ItemId == item.Id);
            if (existing != null)
            {
                existing.Amount = amount;
            }
            else
            {
                var characterItem = new CharacterItemData()
                {
                    CharacterId = characterId,
                    ItemId = item.Id,
                    Amount = amount
                };
                _sql.CharacterItems.Add(characterItem);
            }
            _sql.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error adding item to character: {e}");
            return false;
        }
    }
    
    public bool TryRemoveItemFromCharacter(Item item, int characterId)
    {
        try
        {
            var existing = _sql.CharacterItems
                .FirstOrDefault(e => e.CharacterId == characterId && e.ItemId == item.Id);
            if (existing == null)
                return true;
            _sql.CharacterItems.Remove(existing);
            _sql.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            _logger.LogWarning($"Error removing item from character: {e}");
            return false;
        }
    }
}