from . import get_instance, instantiated, fields_to_string


_instance = get_instance()
_fields = ["vk_group_id", "group_name", "privileges"]
_string_fields = fields_to_string(_fields)
_table = "vk_group"


class VkGroup:
    vk_id: int
    name: str
    privileges: dict

    def __init__(self, data):
        self.vk_id = data[0]
        self.name = data[1]
        self.privileges = data[2]

    def to_dict(self):
        result: dict = {
            "id": self.vk_id,
            "name": self.name,
            "privileges": self.privileges
        }
        return result


def find(group_id):
    data = (group_id,)
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[0]} = %s"
    result = _instance.fetchone(query, data)
    if result is None:
        return 1, None
    group = VkGroup(result)
    return 0, group


def add(group_id, group_name, privileges=None):
    data = (group_id, group_name, privileges, )
    query = f"INSERT INTO {_table}({_string_fields}) VALUES (%s, %s, %s);"
    _instance.execute(query, data)
    return 0


def update(group_id, group_name, privileges=None):
    data = (group_name, privileges, group_id, )
    query = f"UPDATE {_table} SET {_fields[1]}=%s, {_fields[2]}=%s WHERE {_fields[0]}=%s;"
    _instance.execute(query, data)
    return 0


def remove(user_id):
    query = f"DELETE FROM {_table} WHERE {_fields[0]}=%s;"
    data = (user_id,)
    _instance.execute(query, data)
    return 0