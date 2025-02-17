from flask.json import jsonify
from flask import request

from app.api.v0.methods import *
from app.api_controller import get_routers_info, route, version, Access
from app.status import ok
from app.access_management import get_service_token, get_access_token


version("")


@route("auth", ["POST"])
def _authorize():
	content = request.json
	err, payload = get_payload(content)
	if not err:
		err, result = generate_access_token(*get_authorise_data(payload))
		if not err:
			access_token = result
			user_token = access_to_user_token(access_token)
			save_client(payload, user_token)
			return jsonify({"access_token": user_token})
		return result, 406
	return "payload not found", 415


@route("whoami", ["GET"])
def _whoami():
	access_type = None
	access_id = None
	u_token = get_access_token(request)
	g_token = get_service_token(request)
	
	if u_token is not None:
		access_type = "user"
		access_id = get_user_id(u_token)
	if get_service_token(request) is not None:
		access_type = "group"
		access_id = get_group_id(g_token)
		
	return ok({"access":{"type": access_type, "id": access_id}})
