namespace Tdn.Db.Entities;

public class GroupEntityMongoData : MongoDbContext.MongoEntity
{
	public string Name = "";
	public string Description = "";
}

public class ItemMongoData : GroupEntityMongoData {}
public class CharlistMongoData : GroupEntityMongoData {}
public class CharacterMongoData : GroupEntityMongoData 
{
}