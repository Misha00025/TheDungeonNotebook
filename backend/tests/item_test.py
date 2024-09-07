

def start():
    from app.model.GroupItems import GroupItems
    from app.model.Inventory import Inventory, VkUser
    from app.model.Group import Group
    from app.model.Item import Item
    from app.database import item as db
    group = Group("-100")
    user = VkUser("tester")

    def select(item_id = None):
        _group = GroupItems(group)
        print(f"Group: {_group}")
        is_new, inv = Inventory.create_new_or_find(group, user)
        print(f"new: {is_new} Inv: {inv}")
        # print(db.find(group_id=group_id, item_id=item_id))
    
    select()
    item = Item.create_new(group.id, "Test", "Tested")
    select(item.id)

    is_new, inv = Inventory.create_new_or_find(group, user)
    inv: Inventory
    select()

    inv.update_slot(item, 10)
    select()

    print(inv.add(item))
    select()

    item.set(name = "Test 2", description = "description 2")
    select(item.id)
    item.set(name="Test 3")
    select(item.id)

    print(inv.update_slot(item, 10))
    select()

    item.set(description="description 3")
    select(item.id)
    
    item.delete()
    select()

