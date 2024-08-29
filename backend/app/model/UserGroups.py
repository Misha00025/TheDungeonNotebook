from .VkUser import VkUser
from .Group import Group
from app.database import user_group


class UserGroups:
    def __init__(self, user: VkUser | str | int) -> None:
        if user is int: 
            user = str(user)
        if user is str:
            user = VkUser(user)
        self.info = user
        self.groups: dict = {}
        self.admin_in: list = []

    def _find(self):
        err, db_groups = user_group.find(user_id=self.info.id)
        if err:
            raise Exception("Can't find groups")
        for db_group in db_groups:
            group_id = db_group[1]
            group = Group(group_id)
            is_admin = db_group[2]
            self.groups[group_id] = group
            if is_admin:
                self.admin_in.append(group_id)

    def to_dict(self):
        d = self.info.to_dict()
        groups = []
        for group in self.groups.items():
            group: Group
            d_group = group.to_dict()
            d_group["is_admin"] = self.is_admin(group.id)
            groups.append(d_group)
        d["groups"] = groups
        return d

    def is_admin(self, group_id):
        group_id = str(group_id)
        return group_id in self.admin_in
