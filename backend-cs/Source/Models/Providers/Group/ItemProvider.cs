using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class ItemProvider : MongoSQLModelProvider<Item, ItemData, ItemMongoData>
{	
	public ItemProvider(EntityContext dbContext, MongoDbContext mongoContext, ILogger<ItemProvider> logger) : base(dbContext, mongoContext, logger)
	{
	}

	protected override string CollectionName => "items";

	protected override Item BuildModel(ItemData? data)
	{
		if (data == null)
			return new Item(new ItemInfo());
		var mongoItem = GetMongoData(data.UUID, uuid => {
			data.UUID = uuid;
			_dbContext.SaveChanges();
		});
		_logger.LogDebug($"Value of mongoItem: {mongoItem} (name: {mongoItem.Name}, description: {mongoItem.Description})");
		return new Item(new ItemInfo()
		{
			Id = data.Id,
			Name = mongoItem.Name,
			Description = mongoItem.Description
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