namespace Tdn.Models;

public abstract class Entity<TInfo> where TInfo : struct
{
	protected TInfo _info;
	
	public Entity(TInfo info)
	{
		_info = info;
	}
	
	public abstract void SetNewInfo(TInfo info);
}