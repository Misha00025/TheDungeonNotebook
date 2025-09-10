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


@route("whoami", ["GET"])
def _whoami():
    _, at = extract_tokens(rq)
    if at is None:
        return unauthorized()
    uid, gid = extract_ids(at)
    res_id = None
    access_type = "anonymous"
    if uid is not None:
        res_id = uid
        access_type = "user"
    elif gid is not None:
        res_id = gid
        access_type = "group"
    return ok({"id": int(res_id) if res_id is not None else None, "type": access_type})


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

from .groups import *
from .characters import *
from .users import *