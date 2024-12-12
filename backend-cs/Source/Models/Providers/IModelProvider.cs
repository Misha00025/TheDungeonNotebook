namespace Tdn.Api.Models.Providers;

public interface IModelProvider<T> where T : Entity
{
	T GetById(int id);
	List<T> GetByOwnerId(int ownerId);
	IQueryable<T> FindBy(Predicate<T> predicate); 
	
	bool Save(T entity);
	int SaveNew(T entity); // return new id
}