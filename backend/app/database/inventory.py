from . import get_instance, fields_to_string, get_res

_instance = get_instance()
_fields = ["group_id", "owner_id", "inventory_id"]
_string_fields = fields_to_string(_fields)
_table = "inventory"


class ParsedInventory:
    id: int = -1
    group_id: str = ""
    owner_id: str = ""


def _get_inventory(raw) -> ParsedInventory:
    inventory = ParsedInventory()
    inventory.group_id = raw[0]
    inventory.owner_id = raw[1]
    inventory.id = raw[2]


def find(group_id, owner_id=None) -> tuple[int, list[ParsedInventory] | ParsedInventory | None]:
    where = {_fields[0]: group_id}
    many = owner_id is None
    if not many:
        where[_fields[1]] = owner_id
    res = get_res(_instance.select(_table, _string_fields, where, many), _get_inventory)
    return int(res is None), res

def create(group_id, owner_id):
    res = _instance.insert(_table, {_fields[0]: group_id, _fields[1]: owner_id})
    return 0, res

def delete(group_id, owner_id):
    res = _instance.delete(_table, {_fields[0]: group_id, _fields[1]: owner_id})
    return 0, res
