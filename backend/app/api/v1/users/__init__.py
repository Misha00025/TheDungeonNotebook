from app.api_controller import route as rt
from app.api_controller import Access
from flask import request
from . import processor


_prefix = "users/"


def route(url, methods, access = Access.groups):
    url = _prefix+url
    return rt(url, methods, access)


@route("<user_id>", ["GET", "DELETE"])
def _user(user_id):
    match request.method:
        case "GET":
            return processor.get(user_id, request)
        case "DELETE":
            return processor.delete(user_id, request)


@route("", ["GET"])
def _get_users():
    return processor.get_all(request)


@route("add", ["POST"])
def _add_user():
    return processor.add(request)

