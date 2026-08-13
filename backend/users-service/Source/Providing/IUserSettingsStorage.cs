using Tdn.Db.Entities;

namespace Tdn.Models.Providing;

public interface IUserSettingsStorage
{
    UserSettingsMongoData? Find(int userId);
    void Insert(UserSettingsMongoData doc);
    void Replace(UserSettingsMongoData doc);
}
