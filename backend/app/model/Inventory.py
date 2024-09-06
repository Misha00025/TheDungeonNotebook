from app.database import inventory, item_inventory
from app.model.Group import Group
from app.model.Item import Item
from app.model.VkUser import VkUser


class Slot:
    def __init__(self, ii: item_inventory.ParsedItemInventory):
        self.item = Item.get_by_id(ii.item_id)
        self.amount = ii.amount

    def __str__(self) -> str:
        return str(self.to_dict())

    def __repr__(self) -> dict:
        return str(self)

    def to_dict(self):
        res = self.item.to_dict()
        res["amount"] = self.amount
        return res


class Inventory:
    def __init__(self, group: Group, user: VkUser, pi: inventory.ParsedInventory) -> None:
        self._group = group
        self._user = user
        self.id = pi.id

    @staticmethod
    def get_from_db(group: Group, user: VkUser):
        err, inv = inventory.find(group.id, user.id)
        if err:
            return None
        return Inventory(group, user, inv)
    
    @staticmethod
    def create_new_or_find(group: Group, user: VkUser):
        inv = Inventory.get_from_db(group, user)
        is_new = inv is None 
        if is_new:
            inventory.create(group.id, user.id)
            inv = Inventory.get_from_db(group, user)
        return is_new, inv

    @property
    def items(self) -> list[Slot]:
        err, iis = item_inventory.find(self.id)
        items = []
        for ii in iis:
            item = Slot(ii)
            items.append(item)
        return items
    
    def __str__(self) -> str:
        return str(self.to_dict())

    def __repr__(self) -> dict:
        return self.to_dict()
    
    def to_dict(self):
        res = {"id": self.id}
        res["group"] = self._group.to_dict()
        res["user"] = self._user.to_dict()
        res["items"] = [ item.to_dict() for item in self.items ]
        return res

    def have(self, item: Item):
        err, res = item_inventory.find(self.id, item.id)
        return not err

    def add(self, item: Item):
        if self._group.id != item.group_id:
            return False
        item_inventory.add(self.id, item.id)
        return True
    
    def get_slot(self, item: Item):
        err, ii = item_inventory.find(self.id, item.id)
        if ii is None:
            return None
        return Slot(ii)
    
    def update_slot(self, item: Item, amount):
        have = self.have(item)
        if have:
            item_inventory.set(self.id, item.id, amount)
        return have

    def remove(self, item: Item):
        have = self.have(item)
        if not have:
            item_inventory.remove(self.id, item.id)
        return have
    
    def delete(self):
        inventory.delete(self._group.id, self._user.id)