from app.model.Inventory import Inventory, Group, Slot, VkUser
from app.model.GroupItems import GroupItems
from app.model.Item import Item


def get_inventory(group_id, user_id) -> Inventory | None:
    inv = Inventory.create_new_or_find(Group(group_id), VkUser(user_id))
    return inv 


def get_inventory_slot(inventory: Inventory, item_id) -> Slot | None:
    item = Item.get_by_id(item_id)
    if item is None:
        return None
    slot = inventory.get_slot(item)
    return slot


def get_inventory_slot_by_name(inventory: Inventory, name) -> Slot | None:
    item = Item.get_by_name(name)
    if item is None:
        return None
    slot = inventory.get_slot(item)
    return slot


def get_all_items(group_id):
    gi = GroupItems(Group(group_id))
    d = {"items": gi.items}
    return d


def get_inventory_items(group_id, user_id):
    inventory = get_inventory(group_id, user_id)
    if inventory is None:
        return None
    return {"items": inventory.items}


def get_item_by_name(group_id, name):
    item = Item.get_by_name(group_id, name)
    return item


def get_item_by_id(item_id):
    item = Item.get_by_id(item_id)
    return item


def put_item(item_id, name, description):
    item = Item.get_by_id(item_id)
    item.set(name, description)
    name = item.name
    description = item.description
    item = Item.get_by_id(item_id)
    return item.description == description and item.name == name


def put_slot(inventory: Inventory, item_id, amount):
    return inventory.update_slot(Item.get_by_id(item_id), amount)


def remove_slot(inventory: Inventory, item_id):
    return inventory.remove(Item.get_by_id(item_id))


def delete_item(item_id):
    item = Item.get_by_id(item_id)
    ok = item is not None
    if ok:
        item.delete()
    return ok


def create_item(group_id, name, description):
    item = Item.create_new(group_id, name, description)
    return item


def add_item(inventory: Inventory, item_id):
    item = Item.get_by_id(item_id)
    ok = item is not None
    if ok:
        inventory.add(item)
    return ok