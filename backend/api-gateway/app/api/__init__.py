from flask import request as rq
import flask
from app import services
from app.api_controller import get_routers_info, route, version, make_response
from app.status import *
from app.security import *


version("")


@route("get_api", ["GET"])
def _get_api():
    return ok({"api_methods": get_routers_info()})


@route("auth/register", ["POST"])
def _register():
    result = services.auth(rq.headers).register(rq.data)
    return make_response(result)


@route("auth/login", ["POST"])
def _login():
    result = services.auth(rq.headers).login(rq.data)
    return make_response(result)


@route("auth/refresh", ["POST"])
def _refresh():
    rt, _ = extract_tokens(rq)
    if rt is None:
        return unauthorized("Refresh-Token not found")
    result = services.auth(rq.headers).refresh(rt)
    return make_response(result)


@route("users/<int:user_id>", ["GET", "PATCH", "POST"])
def _user(user_id: int):
    _, at = extract_tokens(rq)
    if at is None:
        return unauthorized()
    uid, _ = extract_ids(at)
    users = services.users(rq.headers, user_id)
    match(rq.method):
        case "GET":
            return make_response(users.get())
        case "PATCH":
            if int(uid) != user_id:
                return forbidden()
            return make_response(users.patch(rq.data))
        case "POST":
            if int(uid) != user_id:
                return forbidden()
            return make_response(users.post(rq.data))

from .groups import *
from .characters import *