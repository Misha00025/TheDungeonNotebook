using MongoDB.Bson.Serialization.Attributes;
using Tdn.Db.Contexts;

namespace Tdn.Db.Entities;

public class NoteData : MongoDbContext.MongoEntity
{
	[BsonElement("header")]
	public string Header = "";
	[BsonElement("body")]
	public string Body = "";
	[BsonElement("created_at")]
	public DateTime AdditionDate;
	[BsonElement("updated_at")]
	public DateTime ModifyDate;
}

public class GroupNoteData : NoteData
{
    [BsonElement("group_id")]
    public int GroupId;
}

public class CharacterNoteData : GroupNoteData
{
    [BsonElement("character_id")]
    public int CharacterId;
}