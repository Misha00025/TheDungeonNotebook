import datetime
from app import database


class Note:
    def __init__(self, note_id=None):
        self._exist = False
        self.group_id: str = ""
        self.owner_id: str = ""
        self.note_id: str = ""
        self.header: str = ""
        self.body: str = ""
        self.modified_date: datetime.datetime = None
        if note_id is not None:
            self._find_from_db(note_id)

    def __repr__(self):
        return self.to_dict()

    def __str__(self):
        return str(self.to_dict())

    def to_dict(self):
        err, user = database.vk_user.find(self.owner_id)
        if err:
            raise Exception(user)
        return {
            "group_id": self.group_id,
            "owner_id": self.owner_id,
            "id": self.note_id,
            "header": self.header,
            "body": self.body,
            "last_modify": self.modified_date,
            "author": user.to_dict()
        }

    def is_exist(self):
        return self._exist

    def save(self):
        return database.note.add_auto(self.group_id, self.owner_id, self.header, self.body)

    def update(self):
        database.note.update(self.group_id, self.owner_id, self.note_id, self.header, self.body)

    def delete(self):
        database.note.remove(self.note_id)

    def _find_from_db(self, note_id):
        err, res = database.note.find(note_id=note_id)
        if err:
            self._exist = False
            return
        self.group_id = res[0]
        self.owner_id = res[1]
        self.note_id = note_id
        self.header = res[3]
        self.body = res[4]
        self.modified_date = res[6]
        self._exist = True

