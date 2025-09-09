using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;
using Tdn.Db.Contexts;

namespace Tdn.Db;

public class Counter
{
    [BsonId]
    public string Name { get; set; } = "";
    
    [BsonElement("value")]
    public int Value { get; set; }
}

public class NoteIdGenerator
{
    private readonly IMongoCollection<Counter> _counters;
    
    public NoteIdGenerator(MongoDbContext database)
    {
        _counters = database.GetCollection<Counter>("counters");
    }
    
    public int GetNextNoteIdForGroup(int groupId)
    {
        var counterName = $"notes_group_{groupId}";
        
        var filter = Builders<Counter>.Filter.Eq(c => c.Name, counterName);
        var update = Builders<Counter>.Update.Inc(c => c.Value, 1);
        var options = new FindOneAndUpdateOptions<Counter>
        {
            IsUpsert = true,
            ReturnDocument = ReturnDocument.After
        };
        
        var counter = _counters.FindOneAndUpdate(filter, update, options);
        return counter.Value;
    }
}