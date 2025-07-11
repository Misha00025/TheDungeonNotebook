from flask import request as rq, Response
import flask
import requests
from app import services
from app.api_controller import get_routers_info, route, version
from app.status import *
from app.security import *


version("")


def make_response(result : requests.Response):
    try:
        return result.json(), result.status_code
    except requests.exceptions.JSONDecodeError:
        return result.content, result.status_code


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
            res = services.groups(rq.headers).post(rq.data)
            if res.ok:
                access = services.polices(rq.headers).groups().put(group_id=res.json()["id"], user_id=uid, data=json.dumps({"isAdmin": True}).encode('utf-8'))
                if not access.ok:
                    return answer(500, "Can't create access rule for group")
            return make_response(res)


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
    success, is_admin, response = check_access_to_group(group_id, rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).items().get())
        case "POST":
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).items().post(rq.data))


@route("groups/<int:group_id>/characters", ["GET", "POST"])
def _characters(group_id: int):
    characters = []
    success, is_admin, response = check_access_to_group(group_id, rq, characters)
    if not success:
        return response
    match (rq.method):
        case "GET":
            if is_admin:
                return make_response(services.groups(rq.headers, group_id).characters().get())
            result = []
            for character in characters:
                response = services.groups(rq.headers, group_id).characters(int(character["characterId"])).get()
                if response.ok:
                    result.append(response.json())
            return ok(result)
        case "POST":
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters().post(rq.data))


@route("groups/<int:group_id>/characters/templates", ["GET", "POST"])
def _templates(group_id: int):
    success, is_admin, response = check_access_to_group(group_id, rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).characters().templates().get())
        case "POST":
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters().templates().post(rq.data))


@route("groups/<int:group_id>/items/<int:item_id>", ["GET", "PUT", "DELETE"])
def _item(group_id: int, item_id: int):
    success, is_admin, response = check_access_to_group(group_id, rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).items(item_id).get())
        case "PUT":
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).items(item_id).put(rq.data))
        case "DELETE":
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).items(item_id).put())


@route("groups/<int:group_id>/characters/<int:character_id>", ["GET", "PATCH", "DELETE"])
def _character(group_id: int, character_id: int):
    success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).characters(character_id).get())
        case "PUT":
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).put(rq.data))
        case "DELETE":
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).delete())


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
    success, is_admin, response = check_access_to_group(group_id, rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).characters().templates(template_id).get())
        case "PUT":
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters().templates(template_id).put(rq.data))
        case "DELETE":
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters().templates(template_id).delete())


@route("groups/<int:group_id>/characters/<int:character_id>/items", ["GET", "POST"])
def _character_items(group_id: int, character_id: int):
    success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).characters(character_id).items().get())
        case "POST":
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).items().post(rq.data))


@route("groups/<int:group_id>/characters/<int:character_id>/notes", ["GET", "POST"])
def _character_notes(group_id: int, character_id: int):
    success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).characters(character_id).notes().get())
        case "POST":
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).notes().post(rq.data))


@route("groups/<int:group_id>/characters/<int:character_id>/items/<int:item_id>", ["GET", "PUT", "DELETE"])
def _character_item(group_id: int, character_id: int, item_id: int):
    success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).characters(character_id).items(item_id).get())
        case "PUT":
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).items(item_id).put(rq.data))
        case "DELETE":
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).items(item_id).delete())


@route("groups/<int:group_id>/characters/<int:character_id>/notes/<int:note_id>", ["GET", "PUT", "DELETE"])
def _character_note(group_id: int, character_id: int, note_id: int):
    success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).characters(character_id).notes(note_id).get())
        case "PUT":
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).notes(note_id).put(rq.data))
        case "DELETE":
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).notes(note_id).delete())