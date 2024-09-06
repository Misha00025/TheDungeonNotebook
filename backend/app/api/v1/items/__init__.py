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


@route("<item_id>", ["GET", "PUT", "DELETE", "POST"])
def _item(item_id):
    method = request.method
    # print(item_id)
    match method:
        case "GET":
            return router.get(request, item_id)
        case "PUT":
            return router.put(request, item_id)
        case "DELETE":
            return router.delete(request, item_id)
        case "POST":
            return router.post_add(request, item_id)
    


@route("create", ["POST"])
def _create_item():
    return router.post_new(request)