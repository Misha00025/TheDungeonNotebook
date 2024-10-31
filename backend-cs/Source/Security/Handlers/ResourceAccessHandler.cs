using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Namotion.Reflection;
using TdnApi.Db.Contexts;

namespace TdnApi.Security;

public class ResourceAccessHandler : AuthorizationHandler<ResourceRequirement>
{
	private readonly AccessDbContext _accessDb;
	
	public ResourceAccessHandler(AccessDbContext accessDb) : base()
	{
		_accessDb = accessDb;
	}
	
	protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, ResourceRequirement requirement)
	{
		var access = AccessLevel.None;
		var role = context.User.Claims.First(e => e.Type == ClaimTypes.Role).Value;
		var selfId = GetSelfId(context);
		switch (requirement.Resource)
		{
			case Resource.Group:
				access = AccessToGroup(selfId, GetField(context, Fields.GroupId), role);
				break;
			case Resource.User:
				access = AccessToUser(selfId, GetField(context, Fields.UserId), role);
				break;
			case Resource.Character:
				access = AccessToCharacter(selfId, GetField(context, Fields.GroupId), role);
				break;
		}
		if (access == AccessLevel.None)
		{
			context.Fail();			
		}
		else
		{
			context.Succeed(requirement);
			context.User.Claims.Append(new Claim(ClaimTypes.Role, CastAccessToString(access)));
		}
		return Task.CompletedTask;
	}

	private static string CastAccessToString(AccessLevel accessLevel)
	{
		switch(accessLevel)
		{
			case AccessLevel.Full:
				return AccessLevelAlias.Admin;
			case AccessLevel.Write:
				return AccessLevelAlias.Moderator;
			case AccessLevel.Read:
				return AccessLevelAlias.Follower;
			default:
				return "";
		}
	}
	
	private string GetSelfId(AuthorizationHandlerContext context) =>
		context.User.Claims.First(e => e.Type == ClaimTypes.Name).Value;
	
	private string GetField(AuthorizationHandlerContext context, string key)
	{
		var http = context.Resource as Microsoft.AspNetCore.Http.HttpContext;
		if (http != null)
		{
			var field = http.Request.Query[key].ToString();
			return field;
		}
		return "";
	}
		
	
	private AccessLevel AccessToGroup(string selfId, string groupId, string role)
	{
		var access = AccessLevel.None;
		if (role == Role.Group)
			return selfId == groupId ? AccessLevel.Full : AccessLevel.None;
		var ug = _accessDb.UserGroups.FirstOrDefault(e => e.UserId.ToString() == selfId && e.GroupId.ToString() == groupId);
		if (ug != null)
			access = (AccessLevel)(ug.Privileges+1);
		return access;
	}
	
	private AccessLevel AccessToUser(string selfId, string userId, string role)
	{
		var access = AccessLevel.None;
		if (role == Role.User && (selfId == userId || userId == ""))
			access = AccessLevel.Full;
		return access;
	}
	
	private AccessLevel AccessToCharacter(string selfId, string characterId, string role)
	{
		var access = AccessLevel.None;
		var character = _accessDb.Characters.FirstOrDefault(e => e.Id.ToString() == characterId);
		if (character == null)
			return access;
		var accessToGroup = AccessToGroup(selfId, character.GroupId.ToString(), role);
		if (accessToGroup == AccessLevel.Full || accessToGroup == AccessLevel.None)
			return accessToGroup;
		var uc = _accessDb.UserCharacters.FirstOrDefault(e => 
				e.CharacterId.ToString() == characterId &&
				e.UserId.ToString() == selfId
			);
		if (uc != null)
			access = (AccessLevel)(uc.Privileges+1);
		return access;
	}
}