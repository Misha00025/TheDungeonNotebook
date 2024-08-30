from .Group import Group
from .VkUser import VkUser
from app.database import user_group
from app.processing.founder import user_is_founded
from app.processing.vk_methods import save_client


class GroupUsers:
    def __init__(self, group: Group) -> None:
        self.info = group
        self.users = {}
        self.admins = []
        self._find()

    def _find(self):
        err, db_users = user_group.find(group_id=self.info.id)
        print(self.users)
        if err:
            raise Exception("Can't find users")
        for db_user in db_users:
            user_id = db_user[0]
            user = VkUser(user_id)
            is_admin = db_user[2]
            self.users[user_id] = user
            if is_admin:
                self.admins.append(user_id)
        

    def to_dict(self):
        d = self.info.to_dict()
        users = []
        admins = []
        for key, user in self.users.items():
            user: VkUser
            d_user = user.to_dict()
            if self.is_admin(user.id):
                admins.append(d_user)
            users.append(d_user)
        d["users"] = users
        d["admins"] = admins
        return d

    def is_mine(self, user_id):
        user_id = str(user_id)
        return user_id in self.users.keys()

    def is_admin(self, user_id):
        user_id = str(user_id)
        return user_id in self.admins

    def add_new(self, user_id, admin=False) -> bool:
        user_id = str(user_id)
        if not user_is_founded(user_id):
            save_client(user_id)
        if user_id in self.users.keys():
            return False
        err, res = user_group.add(user_id, self.info.id, admin)
        return bool(err)
    
    def remove_user(self, user_id):
        if not self.is_mine(user_id):
            return False
        err, _ = user_group.remove(user_id, self.info.id)
        return bool(err)

