using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Tdn.Db.Entities;

public class CharacterLogEntry
{
    [BsonElement("timestamp")]
    public DateTime Timestamp { get; set; }

    [BsonElement("actor_id")]
    public int ActorId { get; set; }

    [BsonElement("action_type")]
    public string ActionType { get; set; } = "";

    [BsonElement("details")]
    public BsonDocument Details { get; set; } = new();
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
