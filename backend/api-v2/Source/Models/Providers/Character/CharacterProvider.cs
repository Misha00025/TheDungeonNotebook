using Tdn.Db;
using Tdn.Db.Contexts;
using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public class CharacterProvider : MongoSQLModelProvider<Character, CharacterData, CharacterMongoData>
{
	private CharlistProvider _charlistProvider;
	public CharacterProvider(EntityContext dbContext, MongoDbContext mongoContext, ILogger<CharacterProvider> logger, CharlistProvider charlistProvider) : base(dbContext, mongoContext, logger)
	{
		_charlistProvider = charlistProvider;
	}

	protected override string CollectionName => "characters";

	protected override Character BuildModel(CharacterData data)
	{		
		var charlist = _charlistProvider.GetModel(data.TemplateId.ToString());
		if (charlist == null)
			throw new Exception($"Inconsistent data! Template with id '{data.TemplateId}' not founded");
		var mongoCharacter = GetMongoData(data.UUID, uuid => { data.UUID = uuid; _dbContext.SaveChanges(); });
		var character = new Character( new CharacterInfo(){
			Charlist = new CharlistInfo()
			{
				Id = data.Id,
				Name = mongoCharacter.Name,
				Description = mongoCharacter.Description
			},
			OwnerId = data.OwnerId
			},
			charlist,
			GetFields(mongoCharacter.Fields)
		);
		character.ExtendNotes(mongoCharacter.Notes.Select(e => new Note(){
			Header = e.Header, 
			Body = e.Body,
			AdditionDate = e.AdditionDate,
			ModifyDate = e.ModifyDate
		}));
		character.ExtendItems(mongoCharacter.Items.Select(e => new AmountedItem(new ItemInfo()
		{
			Name = e.Name,
			Description = e.Description
		}, e.Amount)));
		return character;
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
	
	public IEnumerable<Character> GetCharacters(int groupId)
	{
		var charlistData = _dbContext.Set<CharacterData>()
			.Where(e => e.GroupId == groupId).ToList();
		var charlists = charlistData.Select(BuildModel);
		return charlists;
	}
}