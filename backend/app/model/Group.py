import datetime
from app.database import vk_group


class Group:
    def __init__(self, id = None) -> None:
        self._founded = False
        self.id: str = str(id)
        self.name: str = ""
        self._find_in_db()

    def _find_in_db(self):
        err, group = vk_group.find(self.id)
        if err:
            return
        self.name = group.name
        self._founded = True 

    def is_founded(self):
        return self._founded

    def to_dict(self):
        d = {
            "id": self.id,
            "name": self.name
        }
        return d
