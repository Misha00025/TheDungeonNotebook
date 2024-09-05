from app.api_controller import route as rt
from app.api_controller import Access
from flask import request
from . import router


_prefix = "items/"


def route(url, methods, access = Access.users_and_groups):
    url = _prefix+url
    return rt(url, methods, access)


@route("", ["GET"])
def _get_items():
    return router.gets(request)


@route("<item_id>", ["GET", "PUT", "DELETE"])
def _item(item_id):
    method = request.method
    match method:
        case "GET":
            return router.get(request, item_id)
        case "PUT":
            return router.put(request, item_id)
        case "DELETE":
            return router.delete(request, item_id)


@route("add", ["POST"])
def _add_item():
    return router.post_add(request)


@route("create", ["POST"])
def _create_item():
    return router.post_new(request)