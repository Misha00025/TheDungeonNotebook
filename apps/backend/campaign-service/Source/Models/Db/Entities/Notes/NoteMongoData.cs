using MongoDB.Bson.Serialization.Attributes;
using Tdn.Db;

namespace Tdn.Db.Entities;

public class NoteMongoData : MongoDbContextBase.MongoEntity
{
    [BsonElement("body")]
    public string Body = "";
}
