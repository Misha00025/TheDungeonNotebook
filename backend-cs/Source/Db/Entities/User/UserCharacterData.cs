namespace TdnApi.Db.Entities
{
	public class UserCharacterData
	{
		public int UserId;
		public int CharacterId;
		public int Privileges;
		
		public UserData? User;
		public CharacterData? Character;
	}
}