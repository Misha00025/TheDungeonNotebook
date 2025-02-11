
def _exc(err):
    raise Exception(f"User not founded: {err}" )


class VkUser:
    def __init__(self, user_id, on_err = lambda err: print(err)):
        self.id: str = str(user_id)
        self._founded = False
        self._find_from_db(user_id, on_err)

    def _find_from_db(self, user_id, on_err):
        from app.database import vk_user, user_group
        res: vk_user.VkUser
        err, res = vk_user.find(user_id)
        if err:
            on_err(res)
            return
        self.first_name: str = res.first_name
        self.last_name: str = res.last_name
        self.photo_link: str = res.photo
        self._founded = True

    def is_founded(self):
        return self._founded

    def to_dict(self):
        return {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "photo_link": self.photo_link
        }



