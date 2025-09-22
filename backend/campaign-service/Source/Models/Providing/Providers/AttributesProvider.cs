using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class AttributesProvider 
{
    private readonly MongoDbContext _mongo;
    private IMongoCollection<GroupAttributesMongoData> Collection => _mongo.GetCollection<GroupAttributesMongoData>("skills_attributes");

    public AttributesProvider(MongoDbContext mongoDbContext)
    {
        _mongo = mongoDbContext;
    }

    private static Attribute ToAttribute(AttributeMongoData data) => new()
    {
        Key = data.Key,
        Name = data.Name,
        Description = data.Description,
        IsFiltered = data.IsFiltered,
        KnownValues = data.KnownValues
    };

    private static AttributeMongoData ToData(Attribute attribute) => new()
    {
        Key = attribute.Key,
        Name = attribute.Key, 
        Description = attribute.Description,
        IsFiltered = attribute.IsFiltered,
        KnownValues = attribute.KnownValues
    };
    
    public List<Attribute> GetAttributes(int groupId)
    {
        var attributesData = Collection.Find(e => e.GroupId == groupId).FirstOrDefault();
        if (attributesData == null)
            return new();
        var attributes = attributesData.Attributes.Select(ToAttribute).ToList();
        return attributes;
    }
    
    public bool TryGetAttribute(int groupId, string key, out Attribute attribute)
    {
        var attributes = GetAttributes(groupId);
        var nullableAttribute = attributes.FirstOrDefault(e => e.Key == key); 
        if (nullableAttribute == null)
        {
            attribute = new();
            return false;
        }
        attribute = nullableAttribute;
        return true;
    }
    
    public bool TrySaveAttributes(int groupId, IEnumerable<Attribute>attributes)
    {
        var filter = Builders<GroupAttributesMongoData>.Filter.Eq(e => e.GroupId, groupId);
        var update = Builders<GroupAttributesMongoData>.Update.Set(e => e.Attributes, attributes.Select(ToData).ToList());
        var options = new UpdateOptions { IsUpsert = true };
        var result = Collection.UpdateOne(filter, update, options);
        return result.IsAcknowledged && (result.ModifiedCount > 0 || result.UpsertedId != null);
    }
    
    public bool TryAddAttribute(int groupId, Attribute attribute)
    {
        var attributes = GetAttributes(groupId);
        if (attributes.Any(e => e.Key == attribute.Key))
            return false;
        attributes.Add(attribute);
        return TrySaveAttributes(groupId, attributes);
    }
    
    public bool TryPatchAttribute(int groupId, Attribute attribute)
    {
        var attributes = GetAttributes(groupId);
        if (TryGetAttribute(groupId, attribute.Key, out var a))
            attributes.Remove(a);
        attributes.Add(attribute);
        return TrySaveAttributes(groupId, attributes);
    }
}