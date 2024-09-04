from . import get_instance, fields_to_string, get_res

_instance = get_instance()
_fields = ["inventory_id", "item_id", "amount"]
_string_fields = fields_to_string(_fields)
_table = "inventory"


class ParsedItemInventory:
    inventory_id: int = 0
    item_id: int = 0
    amount: int = 0


def _get_ii(raw) -> ParsedItemInventory:
    ii = ParsedItemInventory()
    ii.inventory_id = int(raw[0])
    ii.item_id = int(raw[1])
    ii.amount = int(raw[2])
    return ii


def find(inventory_id, item_id = None) -> tuple[int, list[ParsedItemInventory] | ParsedItemInventory | None]:
    _where = {_fields[0]: inventory_id}
    many = item_id is None
    if not many:
        _where[_fields[1]] = item_id
    res = get_res(_instance.select(_table, _string_fields, _where, many), _get_ii)
    return int(res is None), res


def add(inventory_id, item_id, amount = 1):
    res = _instance.insert(_table, {_fields[0]: inventory_id, _fields[1]: item_id, _fields[2]: amount})
    return 0, res


def set(inventory_id, item_id, amount):
    res = _instance.update(_table, {_fields[2]: amount}, {_fields[0]: inventory_id, _fields[1]: item_id})
    return 0, res


def remove(inventory_id, item_id):
    res = _instance.delete(_table, {_fields[0]: inventory_id, _fields[1]: item_id})
    return 0, res
