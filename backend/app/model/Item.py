from app.database import item

class Item:

    def __init__(self, parsed_item: item.ParsedItem):
        self.group_id: str = parsed_item.group_id
        self.id: int = parsed_item.id
        self.name: str = parsed_item.name
        self.description = parsed_item.description
        self.icon = "https://cdn-icons-png.flaticon.com/512/9501/9501918.png"

    def __str__(self) -> str:
        return str(self.to_dict())

    def __repr__(self) -> dict:
        return str(self.to_dict())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "icon": self.icon
        }

    @staticmethod
    def get_by_id(item_id):
        err, pi = item.find(item_id=item_id)
        if err:
            return None
        return Item(pi)
    
    @staticmethod
    def get_by_name(group_id, name):
        err, pi = item.find_by_name(group_id, name)
        if err:
            return None
        return Item(pi)

    @staticmethod
    def create_new(group_id, name, description):
        item.create(group_id, name, description)
        res = Item.get_by_name(group_id, name)
        return res
    
    def set(self, name=None, description=None):
        err, _ = item.set(self.group_id, self.id, name, description)
        if not err:
            if name is not None:
                self.name = name
            if description is not None:
                self.description = description
        return self
    
    def delete(self):
        item.remove(self.group_id, self.id)
            