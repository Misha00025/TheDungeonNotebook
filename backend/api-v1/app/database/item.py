from . import get_instance, fields_to_string, get_res

_instance = get_instance()
_fields = ["item_id", "group_id", "name", "description"]
_string_fields = fields_to_string(_fields)
_table = "item"


class ParsedItem:
    group_id: str = -1
    id: int = -1
    name: str = ""
    description: str = ""

    def __str__(self) -> str:
        return f"({self.group_id}, {self.id}, {self.name}. {self.description})"
    
    def __repr__(self) -> str:
        return str(self)


def _get_item(raw) -> ParsedItem:
        item = ParsedItem()
        item.id = raw[0]
        item.group_id = raw[1]
        item.name = raw[2]
        item.description = raw[3]
        return item


def find(group_id=None, item_id=None) -> tuple[int, list[ParsedItem] | ParsedItem | None]:
    where = {}
    if group_id is None and item_id is None:
        return 1, None
    if group_id is not None:
        where = {_fields[1]: group_id}
    many = item_id is None
    if not many:
        where[_fields[0]] = item_id
    res = get_res(_instance.select(_table, _string_fields, where=where, many=many), _get_item)
    return int(res is None), res

def find_by_name(group_id, name)  -> tuple[int, list[ParsedItem] | ParsedItem | None]:
    where = {_fields[1]: group_id, _fields[2]: name}
    res = get_res(_instance.select(_table, _string_fields, where=where), _get_item)
    return int(res is None), res

def create(group_id, name, description):
    fields = {_fields[1]: group_id, _fields[2]: name, _fields[3]: description}
    res = _instance.insert(_table, fields)
    return int(res is None), res


def set(group_id, item_id, name=None, description=None):
    if name is None and description is None:
        return 1, "Wrong input: name and description is None"
    fields = {}
    if name is not None:
        fields[_fields[2]] = name
    if description is not None:
        fields[_fields[3]] = description
    res = _instance.update(_table, fields=fields, where={_fields[0]: item_id, _fields[1]: group_id})
    return 0, res


def remove(group_id, item_id):
    item_id = int(item_id)
    res = _instance.delete(_table, {_fields[0]: item_id, _fields[1]: group_id})
    return int(res is None), res