using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class ItemsProvider : DualDbRepository<Item, ItemData, ItemMongoData>
{
    private AttributesProvider _attributes;

    public ItemsProvider(CampaignContext context, IMongoDbContext mongoDbContext, AttributesProvider attributesProvider, ILogger<ItemsProvider> logger)
        : base(context, mongoDbContext, logger)
    {
        _attributes = attributesProvider;
    }

    protected override string CollectionName => "items";

    protected override Expression<Func<ItemData, bool>> GroupFilter(int groupId) => e => e.GroupId == groupId;
    protected override Expression<Func<ItemData, bool>> IdFilter(int groupId, int entityId) => e => e.GroupId == groupId && e.Id == entityId;
    protected override int GetGroupId(Item entity) => entity.Group.Id;
    protected override int GetEntityId(Item entity) => entity.Id;
    protected override void SetEntityId(Item entity, int id) => entity.Id = id;

    protected override Item ToDomain(ItemData sqlData, ItemMongoData mongoData) => ToItem(sqlData, mongoData);

    protected override ItemMongoData ToMongoData(Item entity) => new ItemMongoData()
    {
        Name = entity.Name,
        Description = entity.Description,
        Price = entity.Price,
        Attributes = entity.Attributes
            .Select(e => new ValuedAttributeMongoData()
            {
                Key = e.Key,
                Value = e.Value
            })
            .ToList(),
        IsSecret = entity.IsSecret
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

    public Item? GetItem(int groupId, int itemId) => Get(groupId, itemId);

    public Item? GetItem(int groupId, int itemId, int characterId)
    {
        var data = Db.CharacterItems
                    .Include(e => e.Item)
                    .Where(e => e.Item.GroupId == groupId && e.ItemId == itemId && e.CharacterId == characterId)
                    .Include(e => e.Item.Group)
                    .FirstOrDefault();
        if (data == null) return null;
        var item = FromSqlData(data.Item);
        if (item == null) return null;
        item.Amount = data.Amount;
        return item;
    }

    public IEnumerable<Item> GetItems(int groupId) => GetByGroup(groupId);

    public IEnumerable<Item> GetItems(int groupId, int characterId)
    {
        return Db.CharacterItems
            .Include(e => e.Item)
            .Include(e => e.Item.Group)
            .Where(e => e.Item.GroupId == groupId && e.CharacterId == characterId)
            .AsEnumerable()
            .Select(e => { var item = FromSqlData(e.Item); if (item != null) item.Amount = e.Amount; return item; })
            .Where(e => e != null)
            .ToList()!;
    }

    public bool TryCreateItem(int groupId, Item item) => TryCreate(groupId, item);

    public bool TryUpdateItem(Item item) => TryUpdate(item);

    public bool TryDeleteItem(int groupId, int itemId) => TryDelete(groupId, itemId);

    public bool TrySetItemToCharacter(Item item, int characterId, int amount)
    {
        try
        {
            var existing = Db.CharacterItems
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
                Db.CharacterItems.Add(characterItem);
            }
            Db.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error adding item to character: {e}");
            return false;
        }
    }

    public bool TryRemoveItemFromCharacter(Item item, int characterId)
    {
        try
        {
            var existing = Db.CharacterItems
                .FirstOrDefault(e => e.CharacterId == characterId && e.ItemId == item.Id);
            if (existing == null)
                return true;
            Db.CharacterItems.Remove(existing);
            Db.SaveChanges();
            return true;
        }
        catch (Exception e)
        {
            Logger.LogWarning($"Error removing item from character: {e}");
            return false;
        }
    }
}
