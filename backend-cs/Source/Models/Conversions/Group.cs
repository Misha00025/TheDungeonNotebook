using Tdn.Security;

namespace Tdn.Models.Conversions;

internal static class GroupConvertExtensions
{
	public class DictBuilder
	{
		private Group _group;
		private IEnumerable<Item>? _items = null;
		private IEnumerable<Charlist>? _charlists = null;
		private IEnumerable<Character>? _characters = null;
		private bool _addAdmins = false;
		private bool _addUsers = false;
		public DictBuilder(Group group)
		{
			_group = group;
		}
		
		public DictBuilder WithAdmins() { _addAdmins = true; return this; }
		public DictBuilder WithUsers() { _addUsers = true; return this; }
		public DictBuilder WithItems(IEnumerable<Item> items) { _items = items; return this; }
		public DictBuilder WithCharlists(IEnumerable<Charlist> charlists) { _charlists = charlists; return this; }
		public DictBuilder WithCharacters(IEnumerable<Character> characters) { _characters = characters; return this; }
		
		public Dictionary<string, object?> Build()
		{
			var result = _group.Info.ToDict();
			if (_addAdmins)
			{
				var users = _group.PrepareUsersDicts(AccessLevel.Full);
				result.Add("admins", users);
			}
			if (_addUsers)
			{
				var users = _group.PrepareUsersDicts(AccessLevel.Read);
				result.Add("users", users);
			}
			if (_items != null)
			{
				result.Add("items", _items.Select(e => e.ToDict()));
			}
			return result;
		}
	}
	public static Dictionary<string, object?> ToDict(this Group model, bool addAdmins = false, bool addUsers = false)
	{
		var builder = model.GetDictBuilder();
		if (addAdmins)
			builder.WithAdmins();
		if (addUsers)
			builder.WithUsers();
		return builder.Build();
	}
	
	public static DictBuilder GetDictBuilder(this Group model) => new DictBuilder(model);
	
	public static Dictionary<string, object?> ToDict(this GroupInfo model)
	{
		return new()
		{
			{"id", model.Id},
			{"name", model.Name},
			{"photo_link", model.Icon}
		};
	}
	
	private static List<Dictionary<string, object?>> PrepareUsersDicts(this Group model, AccessLevel level)
	{
		IReadOnlyList<UserInfo> users;
		if (level == AccessLevel.Full)
			users = model.Admins;
		else
			users = model.Users;
		var list = new List<Dictionary<string, object?>>(users.Count);
		foreach (var user in users)
			list.Add(user.ToDict());
		return list;
	}
}