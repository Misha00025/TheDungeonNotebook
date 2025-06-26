namespace Tdn.Api.Paths;


public static class TdnUriPath 
{
	public const string Account = "users/";
	public const string Group = "groups/"+"{"+Fields.GroupId+"}";
	public const string GroupItems = Group + "/items";
	public const string GroupCharacters = Group + "/characters";
	public const string GroupCharlists = GroupCharacters + "/templates";
	public const string Character = "characters/{" + Fields.CharacterID + "}";
	public const string CharacterNotes = Character + "/notes";
	public const string CharacterItems = Character + "/items";
}