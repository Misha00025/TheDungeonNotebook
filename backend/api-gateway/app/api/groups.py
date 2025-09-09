from flask import request as rq, Response
import flask
import requests
from app import services
from app.api_controller import get_routers_info, route, version, make_response
from app.status import *
from app.security import *

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

# Notes

@route("groups/<int:group_id>/notes", ["GET", "POST"])
def _group_notes(group_id: int):
    success, is_admin, response = check_access_to_group(group_id, rq)
    if not success:
        return response
    if not is_admin:
        return forbidden()
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).notes().get())
        case "POST":
            return make_response(services.groups(rq.headers, group_id).notes().post(rq.data))


@route("groups/<int:group_id>/notes/<int:note_id>", ["GET", "PUT", "DELETE"])
def _group_note(group_id: int, note_id: int):
    success, is_admin, response = check_access_to_group(group_id, rq)
    if not success:
        return response
    if not is_admin:
        return forbidden()
    match (rq.method):
        case "GET":
            return make_response(services.groups(rq.headers, group_id).notes(note_id).get())
        case "PUT":
            return make_response(services.groups(rq.headers, group_id).notes(note_id).put(rq.data))
        case "DELETE":
            return make_response(services.groups(rq.headers, group_id).notes(note_id).delete())