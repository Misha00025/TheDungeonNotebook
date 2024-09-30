using TdnApi.Models;
using static TdnApi.Platform;

namespace TdnApi.Builders;

public class UserBuilder : IBuilder<User>
{
	private User _entity = new();
	private string _platform = Vk;
	
	public UserBuilder WithId(string id)
	{
		_entity.Id = id;
		return this;
	}
	
	public UserBuilder WithName(string name)
	{
		_entity.FirstName = name;
		return this;
	}
	
	public UserBuilder FromPlatform(string platform)
	{
		switch (platform)
		{
			case Tdn:
			case Tg:
			case Vk:
				_platform = platform;
				break;
			default:
				_platform = "";
				break;
		}
		return this;
	}
	
	public User? Build()
	{
		if (CheckData())
		{
			
		}
		return null;
	}
	
	
	
	private bool CheckData()
	{
		bool correctPlatform = _platform != "";
		bool correctId = _entity.Id != "";
		bool correctName = _platform == Tdn ? _entity.FirstName != null : _entity.FirstName == null;
		return correctPlatform && correctId && correctName;
	}
}