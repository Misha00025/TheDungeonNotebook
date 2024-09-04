from . import get_instance, fields_to_string

_instance = get_instance()
_fields = ["item_id", "group_id", "name", "description"]
_string_fields = fields_to_string(_fields)
_table = "item"


def find(group_id, item_id=None):
    where = {_fields[1]: group_id}
    many = item_id is None
    if not many:
        where.append((_fields[0], item_id))
    res = _instance.select(_table, _string_fields, where=where, many=many)
    return int(res is None), res

def find_by_name(group_id, name):
    where = {_fields[1]: group_id, _fields[2]: name}
    res = _instance.select(_table, _string_fields, where=where)
    return int(res is None), res

def add(group_id, name, description):
    fields = {_fields[1]: group_id, _fields[2]: name, _fields[3]: description}
    res = _instance.insert(_table, fields)
    return int(res is None), res


def update(group_id, item_id, name=None, description=None):
    if name is None and description is None:
        return 1, "Wrong input: name and description is None"
    fields = {}
    if name is not None:
        fields[_fields[2]] = name
    if description is not None:
        fields[_fields[3]] = description
    res = _instance.update(_table, fields=fields, where={_fields[0]: item_id, _fields[1]: group_id})
    return 0, res


def delete(group_id, item_id):
    item_id = int(item_id)
    res = _instance.delete(_table, {_fields[0]: item_id, _fields[1]: group_id})
    return int(res is None), res