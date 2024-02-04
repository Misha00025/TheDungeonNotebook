import time

from config import connection_settings
from app.databases.MySQLDB import MySQLDB


_instance: MySQLDB = None


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


def _to_string(fields: list):
    string = ""
    for field in fields:
        string += field + ", "
    string = string[:len(string) - 2]
    return string


def find_user_id_from_token(token):
    field = "vk_user_id"
    query = f"SELECT {field} FROM vk_user_token WHERE token = '{token}'"
    result = _instance.fetchone(query)
    if result is not None:
        return 0, result[0]
    return 1, "user not found"


def get_last_authorise(token):
    field = "last_date"
    query = f"SELECT {field} FROM vk_user_token WHERE token = '{token}'"
    result = _instance.fetchone(query)
    if result is not None:
        return 0, result[0]
    return 1, "user not found"


def find_user_from_id(user_id) -> (int, VkUser):
    fields = ["vk_user_id", "first_name", "last_name", "photo_link"]
    string = _to_string(fields)
    query = f"SELECT {string} FROM vk_user WHERE vk_user_id = {user_id}"
    result = _instance.fetchone(query)
    if result is None:
        return 1, None
    user = VkUser(result)
    return 0, user


def save_user(user: VkUser):
    fields = ["vk_user_id", "first_name", "last_name", "photo_link"]
    string = _to_string(fields)
    err, _ = find_user_from_id(user.vk_id)
    if err:
        values = f"('{user.vk_id}','{user.first_name}','{user.last_name}','{user.photo}')"
        command = f"INSERT INTO vk_user({string}) VALUES {values}"
    else:
        command = f"UPDATE `vk_user` " \
                  f"SET {fields[1]}='{user.first_name}',{fields[2]}='{user.last_name}',{fields[3]}='{user.photo}' " \
                  f"WHERE {fields[0]}='{user.vk_id}'"
    _instance.execute(command)


def save_user_token(user_id, token):
    err, _ = find_user_id_from_token(token)
    values = ['vk_user_id', 'token', 'last_date']
    date = time.strftime('%Y-%m-%d %H:%M:%S')
    if err:
        query = f"INSERT INTO vk_user_token({_to_string(values)}) VALUES ('{user_id}','{token}','{date}')"
    else:
        query = f"UPDATE vk_user_token SET last_date = '{date}' WHERE token = '{token}'"
    return _instance.execute(query)


if connection_settings is not None:
    _dbname = connection_settings["DataBaseName"]
    _user = connection_settings["User"]
    _password = connection_settings["Password"]
    _host = connection_settings["Host"]
    _port = connection_settings["Port"]

    _instance = MySQLDB(
        dbname=_dbname,
        user=_user,
        password=_password,
        host=_host,
        port=_port
    )


