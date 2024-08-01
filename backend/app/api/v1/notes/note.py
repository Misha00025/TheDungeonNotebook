from app.model.Note import Note
from flask import request
from flask.json import jsonify
from app.processing.request_parcer import *
from app.model.VkUser import VkUser
from app.errors import forbidden, not_implemented, ok, not_found


def in_keys(k1, k2):
    for k in k1:
        if k not in k2:
            return False
    return True


def generate_note() -> Note:
    note = Note()
    js: dict = request.json
    hard_keys = ["header", "body"]
    if in_keys(hard_keys, js.keys()):
        note.header = js[hard_keys[0]]
        note.body = js[hard_keys[1]]
    else:
        raise Exception("Bad request")
    note.owner_id = get_user_id(request)
    note.group_id = get_group_id(request)
    return note


def check_access(note: Note):
    user_id = get_user_id(request)
    user = VkUser(user_id)
    return note.owner_id == str(user_id) or note.group_id in user.admin_in


def get(note_id):
    note = Note(note_id)
    if not note.is_exist():
        return not_found()
    if check_access(note):
        return jsonify(note.to_dict()), 200
    return forbidden()


def put(note_id):
    note = Note(note_id)
    print(note.to_dict())
    if not note.is_exist():
        return not_found()
    if check_access(note):
        new_note = generate_note()
        new_note.note_id = note_id
        new_note.update()
        return ok()
    return forbidden()


def delete(note_id):
    note = Note(note_id)
    if not note.is_exist():
        return not_found()
    if check_access(note):
        note.delete()
        return ok()
    return forbidden()


def add():
    note = generate_note()
    last_id = note.save()
    return {"last_id": last_id}, 200


def get_all():
    user_id = get_user_id(request)
    group_id = get_group_id(request)
    user = VkUser(user_id)
    if group_id in user.admin_in:
        user_id = None
    from app.database import note
    err, res = note.find(group_id, user_id)
    notes = []
    for nt in res:
        note = Note(nt[2])
        notes.append(note.to_dict())
    print(res)
    return jsonify({"notes": notes}), 200

