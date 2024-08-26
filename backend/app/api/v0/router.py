from flask.json import jsonify
from flask import request

from app.api.v0.methods import *
from app.api_controller import get_routers_info, route, version, Access
from app.statuss import ok
from app.access_managment import get_access_token
from app.access_managment import get_service_token


version("")


@route("get_api", ["GET"])
def _get_api():
    return ok({"api_methods": get_routers_info()})


@route("auth", ["POST"])
def _authorize():
    content = request.json
    err, payload = get_payload(content)
    if not err:
        err, result = generate_access_token(*get_authorise_data(payload))
        if not err:
            access_token = result
            user_token = access_to_user_token(access_token)
            save_client(payload, user_token)
            return jsonify({"access_token": user_token})
        return result, 406
    return "payload not found", 415


@route("check_access", ["GET"], Access.users_and_groups)
def _ping_pong():
    access_type = None
    if get_access_token(request) is not None:
        access_type = "user"
    if get_service_token(request) is not None:
        access_type = "group"
    return ok({"authorised": {"type": access_type}})


@route("groups", ["GET"], Access.users)
def _get_groups():
    token = request.headers.get("token")
    err, user_id = get_user_id(token)
    if err:
        return "user not found", 404
    err, groups = get_groups(user_id)
    if err:
        return "unsupported error", 418
    return jsonify({"groups": groups})

