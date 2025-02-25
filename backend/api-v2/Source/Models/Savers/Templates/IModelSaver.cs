namespace Tdn.Models.Saving;

public interface IModelSaver<TModel>
{
	string CreateNew(TModel model);
	void SaveModel(TModel model);
	bool TrySaveModel(TModel model);
}