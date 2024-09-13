namespace TdnApi.Providers;

public interface IBaseProvider<T> where T : class
{
	T? FindById(string id);
}

public interface IGroupedProvider<T> : IBaseProvider<T> where T : class
{
	IEnumerable<T> FindByGroup(string groupId);
}

public interface IUsersProvider<T> : IBaseProvider<T> where T : class
{
	IEnumerable<T> FindByUser(string userId);
}

public interface IUserGroupProvider<T> : IGroupedProvider<T>, IUsersProvider<T> where T : class
{	
	IEnumerable<T> FindByUserGroup(string userId, string groupId);
}