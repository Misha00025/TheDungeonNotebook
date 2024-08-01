from . import get_instance, instantiated, fields_to_string
from app.processing.common_methods import get_current_time


_instance = get_instance()
_fields = ["group_id", "owner_id", "note_id", "header", "description", "addition_date", "modified_date"]
_string_fields = fields_to_string(_fields)
_table = "note"


def _find_one(note_id):
    data = (note_id,)
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[2]} = %s"
    result = _instance.fetchone(query, data)
    if result is None:
        return 1, None
    return 0, result


def _fetch_all(query, data):
    result = _instance.fetchall(query, data)
    if result is None:
        return 1, None
    return 0, result


def _find_by_group(group_id):
    data = (group_id,)
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[0]} = %s"
    return _fetch_all(query, data)


def _find_by_user(user_id):
    data = (user_id,)
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[1]} = %s"
    return _fetch_all(query, data)


def _find_many(group_id=None, owner_id=None):
    if group_id is None:
        return _find_by_user(owner_id)
    if owner_id is None:
        return _find_by_group(group_id)
    data = (group_id, owner_id,)
    query = f"SELECT {_string_fields} FROM {_table} WHERE {_fields[0]} = %s and {_fields[1]} = %s"
    return _fetch_all(query, data)


def find(group_id=None, owner_id=None, note_id=None):
    if note_id is not None:
        return _find_one(note_id)
    if group_id is None and owner_id is None:
        return 2, None
    return _find_many(group_id, owner_id)


def add(group_id, owner_id, note_id, header, description, addition_date=get_current_time()):
    data = (group_id, owner_id, note_id, header, description, addition_date, addition_date,)
    query = f"INSERT INTO {_table}({_string_fields}) VALUES (%s, %s, %s, %s, %s, %s, %s);"
    return _instance.execute(query, data)


def add_auto(group_id, owner_id, header, description, addition_date=get_current_time()):
    data = (group_id, owner_id, header, description, addition_date, addition_date,)
    fields = _fields.copy()
    fields.remove("note_id")
    query = f"INSERT INTO {_table}({fields_to_string(fields)}) VALUES (%s, %s, %s, %s, %s, %s);"
    res = _instance.execute(query, data)
    return _instance.last_row_id


def update(group_id, owner_id, note_id, header, description, modified_date=get_current_time()):
    data = (header, description, modified_date, group_id, owner_id, note_id,)
    query = f"UPDATE {_table} SET {_fields[3]}=%s, {_fields[4]}=%s, {_fields[6]}=%s "
    query += f"WHERE {_fields[0]} = %s and {_fields[1]} = %s and {_fields[2]} = %s;"
    return _instance.execute(query, data)


def remove(note_id):
    query = f"DELETE FROM {_table} WHERE {_fields[2]}=%s;"
    data = (note_id,)
    return _instance.execute(query, data)