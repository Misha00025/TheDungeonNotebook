using Microsoft.EntityFrameworkCore;
using MongoDB.Bson;
using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Entities;
using Tdn.Models.Providing;

namespace Tdn.Models.Saving;

public class ItemSaver : IModelSaver<Item>
{
	private ItemProvider _provider;
	public ItemSaver(ItemProvider provider)
	{
		_provider = provider;
	}
	private DbContext Context => _provider.Context;
	private MongoDbContext MongoDb => _provider.MongoContext;
	
	public string CreateNew(Item model)
	{
		var set = Context.Set<ItemData>();
		var mongoItem = new ItemMongoData()
		{
			Name = model.Info.Name,
			Description = model.Info.Description,
		};
		var collection = MongoDb.GetCollection<ItemMongoData>("items");
		collection.InsertOne(mongoItem);
		var item = new ItemData()
		{
			GroupId = model.Info.GroupId,
			UUID = mongoItem.Id.ToString(),
		};
		set.Add(item);
		Context.SaveChanges();
		return item.Id.ToString();
	}

	public void SaveModel(Item model)
	{
		var set = Context.Set<ItemData>();
		var item = _provider.Find(model.Id);
		if (item == null)
			throw new Exception("Item is not found");
		var collection = MongoDb.GetCollection<ItemMongoData>("items");
		var itemUUID = new ObjectId(item.UUID);
		var filter = Builders<ItemMongoData>.Filter.Eq("_id", itemUUID);
		
		var mongoItem = new ItemMongoData()
		{
			Id = itemUUID,
			Name = model.Info.Name,
			Description = model.Info.Description,
		};
		collection.ReplaceOne(filter, mongoItem);
	}

	public bool TrySaveModel(Item model)
	{
		try { SaveModel(model); }
		catch { return false; }
		return true;
	}
	
	public void Delete(Item model)
	{	
		var set = Context.Set<ItemData>();
		var item = _provider.Find(model.Id);
		if (item == null)
			throw new Exception("Item is not found");
		var collection = MongoDb.GetCollection<ItemMongoData>("items");
		var filter = Builders<ItemMongoData>.Filter.Eq("_id", new ObjectId(item.UUID));
		set.Remove(item);
		Context.SaveChanges();
		collection.DeleteOne(filter);
	}
}

