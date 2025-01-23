namespace Tdn.Models.Providing;

public interface IModelProvider<T>
{
	delegate void OnModelBuilded(T model);
	event OnModelBuilded? ModelBuilded;
	T GetModel(string uuid);
}