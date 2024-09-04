from .Item import Item
from .Group import Group
from app.database import item


class GroupItems:
    def __init__(self, group: Group):
        self.info = group

    def __str__(self) -> str:
        res = self.to_dict()
        return str(res)

    def __repr__(self) -> dict:
        return self.to_dict()
    
    @property
    def items(self) -> list[Item]:
        _, pis = item.find(group_id=self.info.id)
        items = [ Item(pi) for pi in pis ]
        return items
    
    def to_dict(self):
        res = self.info.to_dict()
        res["items"] = self.items
        return res
    
    def have(self, item: Item):
        return item.group_id == self.info.id

    def add(self, name, description):
        itm = Item.create_new(self.info.id, name, description)
        return itm is not None

    def remove(self, item_id):
        itm = Item.get_by_id(item_id)
        have = self.have(itm)
        if have:
            itm.delete()
        return have