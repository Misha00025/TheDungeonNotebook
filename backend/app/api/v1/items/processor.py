from app.model.GroupUsers import GroupUsers
from app.model.Inventory import Inventory, Group, Slot, VkUser
from app.model.GroupItems import GroupItems
from app.model.Item import Item


def check_user_group(group_id, user_id):
    gu = GroupUsers(Group(group_id))
    return gu.is_mine(user_id)


def get_inventory(group_id, user_id) -> Inventory | None:
    err, inv = Inventory.create_new_or_find(Group(group_id), VkUser(user_id))
    return inv 


def get_inventory_slot(inventory: Inventory, item_id) -> Slot | None:
    item = Item.get_by_id(item_id)
    if item is None:
        return get_inventory_slot_by_name(inventory, item_id)
    slot = inventory.get_slot(item)
    return slot


def get_inventory_slot_by_name(inventory: Inventory, name) -> Slot | None:
    item = Item.get_by_name(inventory._group.id, name)
    if item is None:
        return None
    slot = inventory.get_slot(item)
    return slot


def get_all_items(group_id):
    gi = GroupItems(Group(group_id))
    d = {"items": [item.to_dict() for item in gi.items]}
    return d


def get_inventory_items(group_id, user_id):
    inventory = get_inventory(group_id, user_id)
    if inventory is None:
        return None
    return {"items": inventory.to_dict()["items"]}
    

def get_item_by_name(group_id, name):
    item = Item.get_by_name(group_id, name)
    return item


def get_item_by_id(item_id):
    item = Item.get_by_id(item_id)
    return item


def get_item(group_id, name_or_id):
    item = get_item_by_id(name_or_id)
    if item is None:
        item = get_item_by_name(group_id, name_or_id)
    if item is not None and item.group_id != group_id:
        return None
    return item


def put_item(group_id, item_id, name, description):
    item = get_item(group_id, item_id)
    if item is None: 
        return False
    item.set(name, description)
    name = item.name
    description = item.description
    item = get_item(group_id, item_id)
    if item is None:
        return False
    return item.description == description and item.name == name


def put_slot(inventory: Inventory, item_id, amount):
    if inventory is None:
        return False
    group_id = inventory._group.id
    return inventory.update_slot(get_item(group_id, item_id), amount)


def remove_slot(inventory: Inventory, item_id):
    if inventory is None:
        return False
    group_id = inventory._group.id
    return inventory.remove(get_item(group_id, item_id))


def delete_item(group_id, item_id):
    item = get_item(group_id, item_id)
    ok = item is not None
    if ok:
        item.delete()
    return ok


def create_item(group_id, name, description):
    item = Item.create_new(group_id, name, description)
    return item


def add_item(inventory: Inventory, item_id, amount=1):
    item = get_item(inventory._group.id, item_id)
    slot = get_inventory_slot(inventory, item_id)
    exist_item, exist_slot = item is not None, slot is not None
    ok = exist_item and not exist_slot
    if ok:
        inventory.add(item)
        inventory.update_slot(item, amount)
    return exist_item, exist_slot