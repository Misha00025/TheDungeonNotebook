from .Group import Group
from .VkUser import VkUser
from app.database import user_group


class GroupUsers:
    def __init__(self, group: Group) -> None:
        self.info = group
        self.users = []
        self.admins = []

    def _find(self):
        err, db_users = user_group.find(group_id=self.info.id)
        if err:
            raise Exception("Can't find users")
        for db_user in db_users:
            user_id = db_user[0]
            user = VkUser(user_id)
            is_admin = db_user[2]
            self.users.append(user)
            if is_admin:
                self.admins.append(user_id)

    def to_dict(self):
        d = self.info.to_dict()
        users = []
        admins = []
        for user in self.users:
            user: VkUser
            d_user = user.to_dict()
            if self.is_admin(user.id):
                admins.append(d_user)
            users.append(d_user)
        d["users"] = users
        d["admins"] = admins
        return d

    def is_admin(self, user_id):
        user_id = str(user_id)
        return user_id in self.admins


