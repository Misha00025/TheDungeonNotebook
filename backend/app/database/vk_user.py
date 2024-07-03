from . import get_instance, instantiated, fields_to_string


_instance = get_instance()
fields = ["vk_user_id", "first_name", "last_name", "photo_link"]
string_fields = fields_to_string(fields)

class VkUser:
    vk_id: int
    first_name: str
    last_name: str
    photo: str

    def __init__(self, user=None):
        if user is not None:
            self.vk_id = user[0]
            self.first_name = user[1]
            self.last_name = user[2]
            self.photo = user[3]

    def to_dict(self):
        result: dict = {
            "vk_id": self.vk_id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "photo": self.photo
        }
        return result


def find(user_id):
    data = (user_id,)
    query = f"SELECT {string_fields} FROM vk_user WHERE vk_user_id = %s"
    result = _instance.fetchone(query, data)
    if result is None:
        return 1, None
    user = VkUser(result)
    return 0, user


def add(user_id, first_name, last_name, photo_link):
    data = (user_id, first_name, last_name, photo_link,)
    query = f"INSERT INTO vk_user({string_fields}) VALUES (%s, %s, %s, %s);"
    _instance.execute(query, data)
    return 0


def update(user_id, first_name, last_name, photo_link):
    data = (first_name, last_name, photo_link, user_id,)
    query = f"UPDATE vk_user SET first_name=%s, last_name=%s, photo_link=%s WHERE vk_user_id=%s;"
    _instance.execute(query, data)
    return 0


def remove(user_id):
    query = "DELETE FROM vk_user WHERE vk_user_id=%s;"
    data = (user_id,)
    _instance.execute(query, data)
    return 0
