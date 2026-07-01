from flask import request as rq, Response
from app import services
from app.api_controller import get_routers_info, route, version, make_response
from app.status import *
from app.security import *

@route("groups/<int:group_id>/characters", ["GET", "POST"])
def _characters(group_id: int):
    success, uid, gid, response = check_auth(rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            params = {"userId": uid}
            return make_response(services.groups(rq.headers, group_id).characters().get(params=params))
        case "POST":
            success, is_admin, response = check_access_to_group(group_id, rq)
            if not success:
                return response
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters().post(rq.data))

@route("groups/<int:group_id>/characters/<int:character_id>", ["GET", "PATCH", "DELETE"])
def _character(group_id: int, character_id: int):
    success, uid, gid, response = check_auth(rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            params = {"userId": uid}
            return make_response(services.groups(rq.headers, group_id).characters(character_id).get(params=params))
        case "PATCH":
            success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
            if not success:
                return response
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).patch(rq.data))
        case "DELETE":
            success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
            if not success:
                return response
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).delete())


@route("groups/<int:group_id>/characters/<int:character_id>/users", ["GET"])
def _character_users(group_id: int, character_id: int):
    _, uid, _, _ = check_auth(rq)
    if uid is None:
        return unauthorized()
    
    pres = services.polices({}).groups().characters().get(group_id, character_id)
    if not pres.ok:
        return None
    group_ids: list = pres.json()["users"]
    group_users: list[dict] = []
    for data in group_ids:
        res = services.users(rq.headers, data["userId"]).get()
        if res.ok:
            group_users.append({"user": res.json(), "canWrite": data["canWrite"]})
    return ok({"users": group_users})
        

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


@route("groups/<int:group_id>/characters/templates", ["GET", "POST", "PUT"])
def _templates(group_id: int):
    success, uid, gid, response = check_auth(rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            params = {"userId": uid}
            return make_response(services.groups(rq.headers, group_id).characters().templates().get(params=params))
        case "POST":
            success, is_admin, response = check_access_to_group(group_id, rq)
            if not success:
                return response
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters().templates().post(rq.data))
        case "PUT":
            success, is_admin, response = check_access_to_group(group_id, rq)
            if not success:
                return response
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters().templates().put(rq.data))


@route("groups/<int:group_id>/characters/templates/<int:template_id>", ["GET", "PUT"])
def _template(group_id: int, template_id: int):
    success, uid, gid, response = check_auth(rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            params = {"userId": uid}
            return make_response(services.groups(rq.headers, group_id).characters().templates(template_id).get(params=params))
        case "PUT":
            success, is_admin, response = check_access_to_group(group_id, rq)
            if not success:
                return response
            if not is_admin:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters().templates(template_id).put(rq.data))


@route("groups/<int:group_id>/characters/<int:character_id>/items", ["GET", "POST"])
def _character_items(group_id: int, character_id: int):
    success, uid, gid, response = check_auth(rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            params = {"userId": uid}
            return make_response(services.groups(rq.headers, group_id).characters(character_id).items().get(params=params))
        case "POST":
            success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
            if not success:
                return response
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
    success, uid, gid, response = check_auth(rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            params = {"userId": uid}
            return make_response(services.groups(rq.headers, group_id).characters(character_id).items(item_id).get(params=params))
        case "PUT":
            success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
            if not success:
                return response
            if not can_write:
                return forbidden()
            return make_response(services.groups(rq.headers, group_id).characters(character_id).items(item_id).put(rq.data))
        case "DELETE":
            success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
            if not success:
                return response
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
        

@route("groups/<int:group_id>/characters/<int:character_id>/skills", ["GET"])
def _character_skills(group_id: int, character_id: int):
    success, uid, gid, response = check_auth(rq)
    if not success:
        return response
    match (rq.method):
        case "GET":
            params = dict(rq.args)
            params["userId"] = uid
            return make_response(services.groups(rq.headers, group_id).characters(character_id).skills().get(params=params))


@route("groups/<int:group_id>/characters/<int:character_id>/skills/<int:skill_id>", ["PUT", "DELETE"])
def _character_skill(group_id: int, character_id: int, skill_id: int):
    success, _, can_write, response = check_access_to_character(group_id, character_id, rq)
    if not success:
        return response
    if not can_write:
        return forbidden()
    match (rq.method):
        case "PUT":
            return make_response(services.groups(rq.headers, group_id).characters(character_id).skills(skill_id).put())
        case "DELETE":
            return make_response(services.groups(rq.headers, group_id).characters(character_id).skills(skill_id).delete())
