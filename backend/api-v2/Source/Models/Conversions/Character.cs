using Tdn.Security;

namespace Tdn.Models.Conversions;

internal static class CharacterConvertExtensions
{
	public class DictBuilder
	{
		private Character _character;
		private IEnumerable<AmountedItem>? _items = null;
		private IEnumerable<Note>? _notes = null;
		public DictBuilder(Character character)
		{
			_character = character;
		}
		
		public DictBuilder WithItems(IEnumerable<AmountedItem> items) { _items = items; return this; }
		public DictBuilder WithNotes(IEnumerable<Note> notes) { _notes = notes; return this; }
		
		public Dictionary<string, object?> Build()
		{
			var result = _character.Info.ToDict();
			if (_items != null)
				result.Add("items", _items.Select(e => e.ToDict()));
			if (_notes != null)
				result.Add("notes", _notes.Select(e => e.ToDict()));
			return result;
		}
	}
	
	public static DictBuilder GetDictBuilder(this Character model) => new DictBuilder(model);
	
	public static Dictionary<string, object?> ToDict(this CharlistInfo model)
	{
		return new()
		{
			{"id", model.Id},
			{"name", model.Name},
			{"description", model.Description}
		};
	}
	
	public static Dictionary<string, object?> ToDict(this Note note)
	{
		return new()
		{
			{"header", note.Header},
			{"body", note.Body},
			{"addition_date", note.AdditionDate},
			{"modified_date", note.ModifyDate}	
		};
	}
}