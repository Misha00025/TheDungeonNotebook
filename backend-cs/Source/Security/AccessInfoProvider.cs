using TdnApi.Db.Contexts;

namespace TdnApi.Security;

public interface IAccessLevelProvider
{
	AccessLevel AccessTo(Resource resource, string selfId, string resourceId, string role);
	AccessLevel AccessToGroup(string selfId, string groupId, string role);
	AccessLevel AccessToUser(string selfId, string userId, string role);
	AccessLevel AccessToCharacter(string selfId, string characterId, string role);
}

public class AccessLevelProvider : IAccessLevelProvider
{
	private AccessDbContext _accessDb;
	
	public AccessLevelProvider(AccessDbContext accessDb)
	{
		_accessDb = accessDb;
	}
	
	public AccessLevel AccessTo(Resource resource, string selfId, string resourceId, string role)
	{
		switch(resource)
		{
			case Resource.User:
				return AccessToUser(selfId, resourceId, role);
			case Resource.Group:
				return AccessToGroup(selfId, resourceId, role);
			case Resource.Character:
				return AccessToCharacter(selfId, resourceId, role);
			default:
				return AccessLevel.None;
		}
	}
	
	public AccessLevel AccessToGroup(string selfId, string groupId, string role)
	{
		var access = AccessLevel.None;
		if (role == Role.Group)
			return selfId == groupId ? AccessLevel.Full : AccessLevel.None;
		var ug = _accessDb.UserGroups.FirstOrDefault(e => e.UserId.ToString() == selfId && e.GroupId.ToString() == groupId);
		if (ug != null)
			access = (AccessLevel)(ug.Privileges+1);
		return access;
	}
	
	public AccessLevel AccessToUser(string selfId, string userId, string role)
	{
		var access = AccessLevel.None;
		if (role == Role.User && (selfId == userId || userId == ""))
			access = AccessLevel.Full;
		return access;
	}
	
	public AccessLevel AccessToCharacter(string selfId, string characterId, string role)
	{
		var access = AccessLevel.None;
		// var character = _accessDb.Characters.FirstOrDefault(e => e.Id.ToString() == characterId);
		// if (character == null)
		// 	return access;
		// var accessToGroup = AccessToGroup(selfId, character.GroupId.ToString(), role);
		// if (accessToGroup == AccessLevel.Full || accessToGroup == AccessLevel.None)
		// 	return accessToGroup;
		// var uc = _accessDb.UserCharacters.FirstOrDefault(e => 
		// 		e.CharacterId.ToString() == characterId &&
		// 		e.UserId.ToString() == selfId
		// 	);
		// if (uc != null)
		// 	access = (AccessLevel)(uc.Privileges+1);
		
		// TODO: Add implementation
		return access;
	}
}