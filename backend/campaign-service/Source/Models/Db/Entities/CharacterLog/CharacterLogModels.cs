using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Tdn.Db.Entities;

public class LogDetails
{
    [BsonElement("key")]
    public string Key { get; set; } = "";

    [BsonElement("old_value")]
    public int OldValue { get; set; }

    [BsonElement("delta")]
    public int Delta { get; set; }
}

public class CharacterLogEntry
{
    [BsonElement("timestamp")]
    public DateTime Timestamp { get; set; }

    [BsonElement("actor_id")]
    public int ActorId { get; set; }

    [BsonElement("action_type")]
    public string ActionType { get; set; } = "";

    [BsonElement("details")]
    public LogDetails Details { get; set; } = new();
}

[BsonIgnoreExtraElements]
public class CharacterLogDocument
{
    [BsonId]
    public ObjectId Id { get; set; }

    [BsonElement("character_id")]
    public int CharacterId { get; set; }

    [BsonElement("group_id")]
    public int GroupId { get; set; }

    [BsonElement("entries")]
    public List<CharacterLogEntry> Entries { get; set; } = new();
}
