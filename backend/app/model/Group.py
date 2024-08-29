import datetime
from app.database import vk_group


class Group:
    def __init__(self, id = None) -> None:
        self.id: str = str(id)
        self.name: str = ""

    def _find_in_db(self):
        err, group = vk_group.find(self.id)
        if err:
            raise Exception("Group not founded")
        self.name = group.name

    def to_dict(self):
        d = {
            "id": self.id,
            "name": self.name
        }
        return d
