from app.api_controller import route as rt
from app.api_controller import Access
from flask import request
from . import processor


_prefix = "groups/"


def route(url, methods, access = Access.users_and_groups):
    url = _prefix+url
    return rt(url, methods, access)


@route("<group_id>", ["GET"])
def _get_group(group_id):
    return processor.get(group_id, request)


@route("", ["GET"])
def _get_groups():
    return processor.get_all(request)


