

class VkUser:
    def __init__(self, user_id):
        self._find_from_db(user_id)

    def _find_from_db(self, user_id):
        from app.database import vk_user, user_group
        res: vk_user.VkUser
        err, res = vk_user.find(user_id)
        if err:
            raise Exception("User not founded")
        err, g_res = user_group.find(user_id)
        if err:
            raise Exception("User groups not loaded")
        self.user_id: str = str(res.vk_id)
        self.first_name: str = res.first_name
        self.last_name: str = res.last_name
        self.photo_link: str = res.photo
        self.groups = []
        self.admin_in = []
        for group in g_res:
            self.groups.append(group[1])
            is_admin = group[2]
            if is_admin:
                self.admin_in.append(group[1])

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "photo_link": self.photo_link,
            "groups": self.groups,
            "admin_in": self.admin_in
        }



