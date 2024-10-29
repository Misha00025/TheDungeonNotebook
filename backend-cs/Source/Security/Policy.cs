namespace TdnApi.Security;

public static class Policy
{
	public static class AuthType 
	{
		public const string All = "All";
		public const string Group = "Group";	
		public const string User = "User";
	}
	public const string All = AuthType.All;
	public const string Group = AuthType.Group;
	public const string User = AuthType.User;
	public const string UserOrGroup = "UserOrGroup";
}