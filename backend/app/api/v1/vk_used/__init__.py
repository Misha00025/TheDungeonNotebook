from app.api_controller import route
from flask.json import jsonify
from flask import request
from app.api.v0.methods import get_account_info, save_client
from app.access_managment import authorised


@route("get_user_info/<user_id>", methods=["GET"])
@authorised
def _get_user_info(user_id):
    user_info = get_account_info(user_id)
    return jsonify(user_info)
