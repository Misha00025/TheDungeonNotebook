from . import get_instance, instantiated, fields_to_string


_instance = get_instance()
_fields = ["vk_user_id", "vk_group_id", "is_admin"]
_string_fields = fields_to_string(_fields)
_table = "user_group"


def _make_result(query, data):
    result = _instance.fetchall(query, data)
    if len(result) == 0:
        return 1, None
    return 0, result


def _find_by_user_id(user_id):
    data = (user_id,)
    # print("by ui")
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[0]} = %s"
    return _make_result(query, data)


def _find_by_group_id(group_id):
    data = (group_id,)
    # print("by gi")
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[1]} = %s"
    return _make_result(query, data)


def _find_by_all(user_id, group_id):
    data = (user_id, group_id,)
    # print("by all")
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[0]} = %s and {_fields[1]} = %s"
    err, result = _make_result(query, data)
    if err:
        return err, result
    return err, result[0]


def find(user_id=None, group_id=None):
    if user_id is None and group_id is None:
        return 1, None
    if user_id is None and group_id is not None:
        return _find_by_group_id(group_id)
    if user_id is not None and group_id is None:
        return _find_by_user_id(user_id)
    return _find_by_all(user_id, group_id)


def add(user_id, group_id, is_admin=False):
    data = (user_id, group_id, is_admin, )
    query = f"INSERT INTO {_table}({_string_fields}) VALUES (%s, %s, %s);"
    _instance.execute(query, data)
    return 0,


def update(user_id, group_id, is_admin=False):
    data = (is_admin, user_id, group_id,)
    query = f"UPDATE {_table} SET {_fields[2]}=%s WHERE {_fields[0]}=%s and {_fields[1]}=%s;"
    _instance.execute(query, data)
    return 0,


def remove(user_id, group_id):
    query = f"DELETE FROM {_table} WHERE {_fields[0]}=%s and {_fields[1]}=%s;"
    data = (user_id, group_id,)
    _instance.execute(query, data)
    return 0,

