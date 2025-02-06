using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class CharlistProvider : MongoSQLModelProvider<Charlist, CharlistData, CharlistMongoData>
{
	public CharlistProvider(EntityContext dbContext, MongoDbContext mongoContext, ILogger<CharlistProvider> logger) : base(dbContext, mongoContext, logger)
	{
	}

	protected override string CollectionName => "templates";

	protected override Charlist BuildModel(CharlistData? data)
	{
		if (data == null)
			return new Charlist(new CharlistInfo());
		var mongoCharlist = GetMongoData(data.UUID, uuid => 
		{
			data.UUID = uuid;
			_dbContext.SaveChanges();
		});
		_logger.LogDebug($"Count of fields in charlist template: {mongoCharlist.Fields?.Count}");
		var fields = GetFields(mongoCharlist.Fields != null ? mongoCharlist.Fields : new Dictionary<string, FieldMongoData>());
		return new Charlist(
			new CharlistInfo()
			{
				Id = data.Id,
				Name = mongoCharlist.Name,
				Description = mongoCharlist.Description
			},
			fields
		);
	}
	
	private Dictionary<string, CharlistField> GetFields(Dictionary<string, FieldMongoData> mongoFields)
	{
		var fields = new Dictionary<string, CharlistField>();
		foreach (var field in mongoFields)
		{
			var value = field.Value;
			fields.Add(field.Key, new CharlistField()
			{
				Name = value.Name,
				Description = value.Description,
				Value = value.Value
			});
		}
		return fields;
	}
	
	public IEnumerable<Charlist> GetCharlists(int groupId)
	{
		var charlistData = _dbContext.Set<CharlistData>()
			.Where(e => e.GroupId == groupId).ToList();
		var charlists = charlistData.Select(BuildModel);
		return charlists;
	}
}