from app.api_controller import route
from flask.json import jsonify
from flask import request
from app.processing.vk_methods import *
from app.access_managment import authorised


@route("get_user_info/<user_id>", methods=["GET"])
@authorised
def _get_user_info(user_id):
    user_info = get_user_info(user_id)
    return jsonify(user_info)


@route("group_users", methods=["GET"])
@authorised
def _get_group_users():
    return "Not Implemented", 501


@route("update_user", methods=["PUT"])
@authorised
def _update_user():
    data = request.get_json()
    user_id = data["user_id"]
    group_id = data["group_id"]
    save_client(user_id)
    save_user_group(user_id, group_id)
    print(request.get_json())
    return "OK", 200

