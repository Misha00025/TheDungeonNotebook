

def start():
    from app.database import item
    group_id = "-100"
    db = item
    def select():
        print(db.find(group_id=group_id))
    select()
    print(db.add(group_id, "Test", "Tested"))
    select()
    items = db.find(group_id)[1]
    item_id = items[0].id
    print(db.set(group_id, item_id = item_id, name = "Test 2", description = "description 2"))
    select()
    print(db.set(group_id, item_id, name="Test 3"))
    select()
    print(db.set(group_id, item_id, description="description 3"))
    select()
    for i in items:
        print(db.remove(group_id, i.id))
    select()

