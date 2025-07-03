from flask import request as rq, Response
import requests
from app import services
from app.api_controller import get_routers_info, route, version
from app.status import *
from app.security import *


version("")


def make_response(result : requests.Response):
    return Response(
            result.content,
            result.status_code,
            content_type=result.headers['Content-Type']
        )


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
        return unauthorized()
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


@route("groups", ["GET", "POST"])
def _groups():
    success, uid, gid, response = check_auth(rq)
    if not success:
        return response
    if gid is not None:
        if rq.method == "POST":
            return forbidden()
        return make_response(services.groups(rq.headers, gid).get())
    if uid is None:
        return forbidden()
    match(rq.method):
        case "GET":
            accesses = get_user_accesses(uid)
            if accesses is None:
                return forbidden()
            groups = []
            for access in accesses:
                res = services.groups(rq.headers, int(access["groupId"])).get()
                if res.ok:
                    groups.append(res.json())
            return ok({"groups": groups})
        case "POST":
            return make_response(services.groups(rq.headers).post(uid, rq.data))


# TODO: Вернуть DELETE метод, когда буду готов
@route("groups/<int:group_id>", ["GET", "PATCH"]) 
def _group(group_id: int):
    success, is_admin, response = check_access_to_group(group_id, rq)
    if not success:
        return response
    groups = services.groups(rq.headers, group_id)
    match(rq.method):
        case "GET":
            return make_response(groups.get())
        case "PATCH":
            if not is_admin:
                return forbidden()
            return make_response(groups.patch(rq.data))


@route("groups/<int:group_id>/users", ["GET"])
def _group_users(group_id: int):
    success, _, response = check_access_to_group(group_id, rq)
    if not success:
        return response
    pres = services.polices({}).groups().all(group_id=group_id)
    if not pres.ok:
        return None
    group_ids: list = pres.json()["users"]
    group_users: list[dict] = []
    for data in group_ids:
        res = services.users(rq.headers, data["userId"]).get()
        if res.ok:
            group_users.append({"user": res.json(), "isAdmin": data["isAdmin"]})
    return ok({"users": group_users})


@route("groups/<int:group_id>/users/<int:user_id>", ["PUT", "DELETE"])
def _group_user(group_id: int, user_id: int):
    success, is_admin, response = check_access_to_group(group_id, rq)
    if not success:
        return response
    if not is_admin:
        return forbidden()
    match(rq.method):
        case "PUT":
            return make_response(services.polices(rq.headers).groups().put(group_id, user_id, rq.data))
        case "DELETE":
            return make_response(services.polices(rq.headers).groups().delete(group_id, user_id))    


@route("groups/<int:group_id>/items", ["GET", "POST"])
def _items(group_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters", ["GET", "POST"])
def _characters(group_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/templates", ["GET", "POST"])
def _templates(group_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/items/<int:item_id>", ["GET", "PUT", "DELETE"])
def _item(group_id: int, item_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/<int:character_id>", ["GET", "PATCH", "DELETE"])
def _character(group_id: int, character_id: int):
    raise NotImplementedError()


# @route("groups/<int:group_id>/characters/<int:character_id>/users", ["GET"])
# def _character_users(group_id: int, character_id: int):
#     success, _, response = check_access_to_character(group_id, character_id, rq)
#     if not success:
#         return response
#     pres = services.polices({}).groups().characters().get(group_id=group_id)
#     if not pres.ok:
#         return None


@route("groups/<int:group_id>/characters/<int:character_id>/users/<int:user_id>", ["PUT", "DELETE"])
def _character_user(group_id: int, character_id: int, user_id: int):
    success, is_admin, _, response = check_access_to_character(group_id, character_id, rq)
    if not success:
        return response
    if not is_admin:
        return forbidden()
    match(rq.method):
        case "PUT":
            return make_response(services.polices(rq.headers).groups().characters().put(group_id, user_id, character_id, rq.data))
        case "DELETE":
            return make_response(services.polices(rq.headers).groups().characters().delete(group_id, user_id, character_id))    


@route("groups/<int:group_id>/characters/templates/<int:template_id>", ["GET", "PUT", "DELETE"])
def _template(group_id: int, template_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/<int:character_id>/items", ["GET", "POST"])
def _character_items(group_id: int, character_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/<int:character_id>/notes", ["GET", "POST"])
def _character_notes(group_id: int, character_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/<int:character_id>/items/<int:item_id>", ["GET", "PUT", "DELETE"])
def _character_items(group_id: int, character_id: int, item_id: int):
    raise NotImplementedError()


@route("groups/<int:group_id>/characters/<int:character_id>/notes/<int:note_id>", ["GET", "PUT", "DELETE"])
def _character_notes(group_id: int, character_id: int, note_id: int):
    raise NotImplementedError()