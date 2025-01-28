namespace Tdn.Models;

public abstract class Entity<TInfo> where TInfo : struct
{
	protected TInfo _info;
	
	public Entity(TInfo info)
	{
		_info = info;
	}
	
	public TInfo Info => _info;
	public delegate void OnUpdate(Entity<TInfo> entity);
	public event OnUpdate? Updated = null;
	
	protected abstract void SetNewInfo(TInfo info);
	
	public void UpdateInfo(TInfo info)
	{
		SetNewInfo(info);
		Updated?.Invoke(this);
	}
}