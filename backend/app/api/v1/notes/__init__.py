from app.api_controller import route as rt
from app.access_managment import authorised_user, authorised_group, authorised
from flask import request
from . import note


_prefix = "notes/"


def route(url, methods):
    return rt(_prefix+url, methods)


@route("", ["GET"])
@authorised
def _get_notes():
    return note.get_all()


@route("<note_id>", ["GET", "PUT", "DELETE"])
@authorised
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
@authorised
def _add_note():
    return note.add()