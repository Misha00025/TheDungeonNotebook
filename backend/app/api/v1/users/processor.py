from flask import Request
from app.processing.request_parser import *
from app.model.GroupUsers import GroupUsers, Group, VkUser
from app.processing.request_parser import get_group_id, get_user_id, get_admin_status, from_bot, from_user
from app.status import ok, forbidden, created, not_found, accepted


def get(user_id: int, rq: Request):
    user_id = str(user_id)
    group_id = get_group_id(rq)
    group = GroupUsers(Group(group_id))
    if user_id not in group.users.keys():
        return forbidden()
    user: VkUser
    user = group.users[user_id]
    return user.to_dict()


def get_all(rq: Request):
    if from_bot(rq):
        group_id = get_group_id(rq)
        group = GroupUsers(Group(group_id))
        dg = group.to_dict()
        d = {
            "admins": dg["admins"],
            "users": dg["users"]
        }
        return ok(d)
    if from_user(rq):
        user_id = get_user_id(rq)
        user = VkUser(user_id)
        return ok(user.to_dict())


def add(rq: Request):
    user_id = get_user_id(rq)
    group_id = get_group_id(rq)
    group = GroupUsers(group_id)
    is_admin = get_admin_status(rq)
    accept = group.add_new(user_id, is_admin)
    if accept:
        return created()
    return Exception(f"Can't add user {user_id} to group {group_id}")


def delete(user_id, rq: Request):
    group_id = get_group_id(rq)
    group = GroupUsers(Group(group_id))
    access = group.remove_user(user_id)
    if not access:
        return not_found("User not found")
    return accepted("User removed")

