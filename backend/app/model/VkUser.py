

class VkUser:
    def __init__(self, user_id):
        self._find_from_db(user_id)

    def _find_from_db(self, user_id):
        from app.database import vk_user, user_group
        res: vk_user.VkUser
        err, res = vk_user.find(user_id)
        if err:
            raise Exception(f"User not founded: {res}")
        self.id: str = str(res.vk_id)
        self.first_name: str = res.first_name
        self.last_name: str = res.last_name
        self.photo_link: str = res.photo

    def to_dict(self):
        return {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "photo_link": self.photo_link
        }



