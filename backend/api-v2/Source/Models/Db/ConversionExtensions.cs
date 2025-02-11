using Tdn.Db.Entities;
using Tdn.Security;
using Tdn.Models;
using MongoDB.Bson;
using Microsoft.EntityFrameworkCore.Metadata.Internal;

namespace Tdn.Db.Convertors;

public static class ConversionExtensions
{
	public static UserInfo ToInfo(this UserData data)
	{
		return new UserInfo(){
			Id = data.Id, 
			FirstName = data.FirstName, 
			LastName = data.LastName,
			Icon = data.PhotoLink			
		};
	}
	
	public static AmountedItemMongoData ToData(this AmountedItem item)
	{
		return new AmountedItemMongoData()
		{
			Name = item.Info.Name,
			Description = item.Info.Description,
			Image = "", // FIXME: Add icon to items	
			Amount = item.Amount
		};
	}
	
	public static NoteMongoData ToData(this Note note)
	{
		return new NoteMongoData()
		{
			Header = note.Header,
			Body = note.Body,
			AdditionDate = note.AdditionDate,
			ModifyDate = note.ModifyDate
		};
	}
	
	public static Dictionary<string, FieldMongoData> ToDataDict(this IReadOnlyDictionary<string, CharlistField> fields)
	{
		var result = new Dictionary<string, FieldMongoData>();
		foreach (string key in fields.Keys)
		{
			var field = fields[key];
			result.Add(key, new FieldMongoData()
			{
				Name = field.Name,
				Description = field.Description,
				Value = field.Value,
			});
		}
		return result;
	}
	
	public static CharacterMongoData ToData(this Character character, string uuid)
	{
		var data = new CharacterMongoData()
		{
			Id = new ObjectId(uuid),
			Name = character.Name,
			Description = character.Description,
			Fields = character.Fields.ToDataDict(),
			Notes = character.Notes.Select(e => e.ToData()).ToList(),
			Items = character.Items.Select(e => e.ToData()).ToList()
		};
		return data;
	}
	
	public static AccessLevel ToAccessLevel(this int level) => level < 3 && level >= 0 ? (AccessLevel)(level+1) : AccessLevel.None;
}