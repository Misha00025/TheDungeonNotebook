from app.api_controller import route, Access
from flask.json import jsonify
from flask import request
from app import database
from app.processing.vk_methods import *
from app.processing.founder import *
from app.processing.request_parser import *
from app.processing.group_controller import *


@route("get_user_info/<user_id>", methods=["GET"], access=Access.groups)
def _get_user_info(user_id):
    user_info = get_user_info(user_id)
    return jsonify(user_info)


@route("user_is_mine", methods=["GET"], access=Access.groups)
def _get_group_users():
    user_id = get_user_id(request)
    st = get_service_token(request)
    group_id = find_group_id_by(st)
    result = find_user_by_group(group_id, user_id)
    return {"status": result is not None}, 200


@route("update_user_info", methods=["PUT"], access=Access.groups)
def _update_user():
    user_id = get_user_id(request)
    if not user_is_founded(user_id):
        return "USER NOT FOUND", 404
    save_client(user_id)
    return "OK", 200


@route("add_user_to_me", methods=["POST"], access=Access.groups)
def _add_user_to_group():
    user_id = get_user_id(request)
    print(user_id)
    if not user_is_founded(user_id):
        save_client(str(user_id))
    st = get_service_token(request)
    group_id = find_group_id_by(st)
    is_admin = get_admin_status(request)
    add_user_to_group(group_id, user_id, is_admin)
    return "OK", 200





