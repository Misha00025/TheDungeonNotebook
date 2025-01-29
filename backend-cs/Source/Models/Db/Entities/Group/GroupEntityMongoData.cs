namespace Tdn.Db.Entities;

public class GroupEntityMongoData : MongoDbContext.MongoEntity
{
	public string name = "";
	public string description = "";
}

public class ItemMongoData : GroupEntityMongoData {}
public class CharlistMongoData : GroupEntityMongoData {}
public class CharacterMongoData : GroupEntityMongoData 
{
}