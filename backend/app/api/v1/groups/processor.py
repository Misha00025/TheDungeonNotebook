from flask import Request
from app.processing.request_parser import *
from app.model.GroupUsers import GroupUsers
from app.model.UserGroups import UserGroups, Group
from app.processing.request_parser import get_group_id, get_user_id, from_bot
from app.status import ok, forbidden


def get(group_id: int, rq: Request):
    d: dict
    is_admin = True
    group_id = str(group_id)
    if not from_bot(rq):
        user_id = get_user_id(rq)
        user = UserGroups(user_id)
        if group_id not in user.groups.keys():
            return forbidden()
        is_admin = user.is_admin(group_id)
    group = GroupUsers(group_id)
    d = group.to_dict()
    if not is_admin:
        d.pop("users")
    return ok(d)


def get_all(rq: Request):
    if from_bot(rq):
        return get(get_group_id(rq), rq)
    user_id = get_user_id(rq)
    user = UserGroups(user_id)
    d = {"groups": user.to_dict()["groups"]}
    return ok(d)

