from . import get_instance, instantiated, fields_to_string
from app.processing.common_methods import get_current_time


_instance = get_instance()
_fields = ["vk_user_id", "token", "last_date"]
_string_fields = fields_to_string(_fields)
_table = "vk_user_token"


def find(token):
    print(f"{token} - {type(token)}")
    data = (token,)
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[1]} = %s"
    result = _instance.fetchone(query, data)
    if result is None:
        return 1, None
    return 0, result


def add(user_id, token, last_date=get_current_time()):
    data = (user_id, token, last_date,)
    query = f"INSERT INTO {_table}({_string_fields}) VALUES (%s, %s, %s);"
    return _instance.execute(query, data)


def update(token, last_date=get_current_time()):
    data = (last_date, token,)
    query = f"UPDATE {_table} SET {_fields[2]}=%s WHERE {_fields[1]}=%s;"
    return _instance.execute(query, data)


def remove(token):
    query = f"DELETE FROM {_table} WHERE {_fields[1]}=%s;"
    data = (token,)
    return _instance.execute(query, data)
