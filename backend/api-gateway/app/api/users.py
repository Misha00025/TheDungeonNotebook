from flask import request as rq
from app import services
from app.api_controller import get_routers_info, route, version, make_response
from app.status import *
from app.security import *


@route("users", ["GET", "POST"])
def _post_user():
    users = services.users(rq.headers)
    match(rq.method):
        case "GET":
            params = rq.args.to_dict()
            return make_response(users.get(params=params))
        case "POST":
            _, at = extract_tokens(rq)
            if at is None:
                return unauthorized()
            uid, _ = extract_ids(at)
            if uid is None:
                return forbidden()
            data: dict = rq.get_json()
            data["id"] = int(uid) 
            return make_response(users.post(json=data))


@route("users/<int:user_id>", ["GET", "PATCH"])
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