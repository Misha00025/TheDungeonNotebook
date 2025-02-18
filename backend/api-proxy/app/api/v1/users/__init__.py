import requests
from app import BACKEND_SERVICE_URL
from app.api_controller import route as rt
from app.api_controller import Access
from flask import jsonify, request
from app.processing.common_methods import check_token, get_request_meta_data
from app.status import not_implemented, not_found, forbidden


_prefix = "users/"


def route(url, methods, access = Access.groups):
	url = _prefix+url
	return rt(url, methods, access)


@route("<user_id>", ["GET", "DELETE"])
def _user(user_id):
	if request.method != "GET":
		return not_implemented()
	token = request.headers.get("token")
	if not token:
		token = request.headers.get("serviceToken")
		if not token:
			return "Missing token", 401
	whoami = check_token(token)
	if whoami["access"]["type"] != "group":
		return forbidden()
	meta_data = get_request_meta_data()
	url = f"{BACKEND_SERVICE_URL}/groups/{whoami["access"]["id"]}"
	response = requests.get(url, **meta_data)
	if response.status_code == 200:
		data = response.json()["data"]
		for user in data["users"] + data["admins"]:
			if str(user["id"]) == str(user_id):
				return jsonify(user), 200
		return not_found()
	return response.content, response.status_code	


@route("", ["GET"], Access.users_and_groups)
def _get_users():
	token = request.headers.get("token")
	if not token:
		token = request.headers.get("serviceToken")
		if not token:
			return "Missing token", 401
	whoami = check_token(token)
	if whoami is None:
		return "Access denied", 403
	if whoami["access"]["type"] == "group":
		meta_data = get_request_meta_data()
		url = f"{BACKEND_SERVICE_URL}/groups/{whoami["access"]["id"]}"
		response = requests.get(url, **meta_data)
		if response.status_code == 200:
			return jsonify(response.json()["data"]), 200
		return response.content, response.status_code
	if whoami["access"]["type"] == "user":
		meta_data = get_request_meta_data()
		url = f"{BACKEND_SERVICE_URL}/account"
		response = requests.get(url, **meta_data)
		if response.status_code == 200:
			return jsonify(response.json()["data"]), 200
		return response.content, response.status_code
	return "Unknown access type", 500


@route("add", ["POST"])
def _add_user():
	return not_implemented()

