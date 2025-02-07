namespace Tdn.Security;

public static class Policy
{
	
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
}