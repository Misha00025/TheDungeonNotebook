using Tdn;
using Tdn.Security;

namespace Tdn.Security.Conversions;

public static class ConversionExtensions
{
	public static string GetFieldName(this Resource resource)
	{
		switch(resource)
		{
			case Resource.User:
				return Fields.UserId;
			case Resource.Group:
				return Fields.GroupId;
			case Resource.Character:
				return Fields.CharacterID;
			default:
				return "";
		}
	}
	
	public static string ToAlias(this AccessLevel accessLevel)
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
}