using Tdn.Security.Conversions;
using Tdn.Db.Entities;
using Tdn.Security;
using Tdn.Models;

namespace Tdn.Db.Convertors;

public static class ConversionExtensions
{
	public static UserInfo ToInfo(this UserData data)
	{
		return new UserInfo(){
			Id = data.Id, 
			FirstName = data.FirstName, 
			LastName = data.LastName,
			Icon = data.PhotoLink			
		};
	}
	
	public static AccessLevel ToAccessLevel(this int level) => level < 3 && level >= 0 ? (AccessLevel)(level+1) : AccessLevel.None;
}