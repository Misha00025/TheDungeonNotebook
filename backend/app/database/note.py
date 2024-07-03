from . import get_instance, instantiated, fields_to_string
from app.processing.common_methods import get_current_time


_instance = get_instance()
_fields = ["group_id", "owner_id", "note_id", "header", "description", "addition_date", "modified_date"]
_string_fields = fields_to_string(_fields)
_table = "note"


def _find_one(group_id, owner_id, note_id):
    data = (group_id, owner_id, note_id,)
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[0]} = %s and {_fields[1]} = %s and {_fields[2]} = %s"
    result = _instance.fetchone(query, data)
    if result is None:
        return 1, None
    return 0, result


def _find_many(group_id, owner_id):
    data = (group_id, owner_id,)
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[0]} = %s and {_fields[1]} = %s"
    result = _instance.fetchall(query, data)
    if result is None:
        return 1, None
    return 0, result


def find(group_id, owner_id, note_id=None):
    if note_id is not None:
        return _find_one(group_id, owner_id, note_id)


def add(group_id, owner_id, note_id, header, description, addition_date=get_current_time()):
    data = (group_id, owner_id, note_id, header, description, addition_date, addition_date,)
    query = f"INSERT INTO {_table}({_string_fields}) VALUES (%s, %s, %s, %s, %s, %s);"
    return _instance.execute(query, data)


def update(group_id, owner_id, note_id, header, description, modified_date):
    data = (header, description, modified_date, group_id, owner_id, note_id,)
    query = f"UPDATE {_table} SET {_fields[3]}=%s, {_fields[4]}=%s, {_fields[6]}=%s "
    query += f"WHERE {_fields[0]} = %s and {_fields[1]} = %s and {_fields[2]} = %s;"
    return _instance.execute(query, data)


def remove(token):
    query = f"DELETE FROM {_table} WHERE {_fields[1]}=%s;"
    data = (token,)
    return _instance.execute(query, data)