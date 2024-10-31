namespace TdnApi.Security;

public static class Policy
{
	public static class AuthType 
	{
		public const string All = "All";
		public const string Group = "Group";	
		public const string User = "User";
	}
	
	public static class AccessLevel
	{
		public const string Admin = "Admin";
		public const string Moderator = "Moderator";
		public const string Follower = "Follower";
	}
	
	public static class ResourceAccess
	{
		public const string User = "To User";
		public const string Group = "To Group";
		public const string Character = "To Character";		
	}
	
	public const string All = AuthType.All;
	public const string Group = AuthType.Group;
	public const string User = AuthType.User;
	public const string UserOrGroup = "UserOrGroup";
}