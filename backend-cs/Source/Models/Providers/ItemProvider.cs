using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class ItemProvider : MongoSQLModelProvider<Item, ItemData, ItemMongoData>
{
	private ILogger _logger;
	
	public ItemProvider(EntityContext dbContext, MongoDbContext mongoContext, ILogger<ItemProvider> logger) : base(dbContext, mongoContext)
	{
		_logger = logger;
	}

	protected override string CollectionName => "items";

	protected override Item BuildModel(ItemData? data)
	{
		if (data == null)
			return new Item(new ItemInfo());
		var mongoItem = GetMongoData(data.UUID);
		if (mongoItem == null)
		{
			_logger.LogWarning($"Inconsistent data between SQL and NoSQL: Item with UUID {data.UUID} does not exist in NoSQL. Creating new...");
			mongoItem = new();
			var collection = _mongoContext.GetCollection<ItemMongoData>(CollectionName);
			collection.InsertOne(mongoItem);
			data.UUID = mongoItem.Id.ToString();
			_dbContext.SaveChanges();
			_logger.LogInformation($"Item with UUID {data.UUID} created");
		}
		_logger.LogDebug($"Value of mongoItem: {mongoItem} (name: {mongoItem.name}, description: {mongoItem.description})");
		return new Item(new ItemInfo()
		{
			Id = data.Id,
			Name = mongoItem.name,
			Description = mongoItem.description
		});
	}
	
	public IEnumerable<Item> GetItems(int groupId)
	{
		var itemsData = _dbContext.Set<ItemData>()
			.Where(e => e.GroupId == groupId).ToList();
		var items = itemsData.Select(BuildModel);
		return items;
	}
}