from app.api_controller import route as rt
from app.api_controller import Access
from app.access_managment import authorized_user, authorized_group, authorized
from flask import request
from . import note


_prefix = "notes/"


def route(url, methods, access = Access.users_and_groups):
    return rt(_prefix+url, methods, access)


@route("", ["GET"])
def _get_notes():
    return note.get_all()


@route("<note_id>", ["GET", "PUT", "DELETE"])
def _note(note_id):
    print()
    match request.method:
        case "GET":
            return note.get(note_id)
        case "PUT":
            return note.put(note_id)
        case "DELETE":
            return note.delete(note_id)


@route("add", ["POST"])
def _add_note():
    return note.add()