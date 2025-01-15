namespace Tdn.Models.Providing;

public interface IModelProvider<T>
{
	T GetModel(string uuid);
	
	bool TrySaveModel(T Models);
}