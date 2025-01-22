namespace Tdn.Models.Providing;

public interface IModelProvider<T>
{
	T GetModel(string uuid);
}