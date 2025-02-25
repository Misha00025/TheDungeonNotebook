using MongoDB.Driver;
using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Convertors;
using Tdn.Db.Entities;
using Tdn.Models.Conversions;
using Tdn.Models.Providing;

namespace Tdn.Models.Saving;

public class CharacterSaver : IModelSaver<Character>
{
	private CharacterProvider _provider;
	private MongoDbContext _mongoContext;
	private ILogger _logger;
	
	public CharacterSaver(CharacterProvider provider, ILogger<CharacterSaver> logger)
	{
		_provider = provider;
		_mongoContext = provider.MongoContext;
		_logger = logger;
	}
	
	public string CreateNew(Character model)
	{
		throw new NotImplementedException();
	}

	public void SaveModel(Character model)
	{
		var data = _provider.Find(model.Id);
		if (data == null)
			throw new Exception($"Can't find character data with id: {model.Id}");
		var uuid = data.UUID;
		CharacterMongoData mongoData = model.ToData(uuid);
		var collection = _provider.MongoContext.GetCollection<CharacterMongoData>("characters");
		var filter = Builders<CharacterMongoData>.Filter.Eq("_id", mongoData.Id);
		collection.ReplaceOne(filter, mongoData);
	}

	public bool TrySaveModel(Character model)
	{
		try
		{
			SaveModel(model);
		}
		catch (Exception e)
		{
			_logger.LogCritical(e.Message);
			return false;
		}
		return true;		
	}
}