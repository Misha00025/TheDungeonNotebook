import os
import requests
from app import BACKEND_SERVICE_URL
from app.api_controller import route as rt
from app.api_controller import Access
from flask import Response, jsonify, request

from app.processing.common_methods import check_token, get_request_meta_data


_prefix = "groups/"


def route(url, methods, access = Access.users_and_groups):
	url = _prefix+url
	return rt(url, methods, access)


@route("<group_id>", ["GET"])
def v1_get_group(group_id):
	url = f"{BACKEND_SERVICE_URL}/groups/{group_id}"
	request_meta_data = get_request_meta_data()
	response = requests.get(url,**request_meta_data)
	if response.status_code == 200:
		return jsonify(response.json()["data"]+{"is_admin": response.json()["access_level"] == "Admin"}), 200
	return response.content, response.status_code


@route("", ["GET"])
def v1_get_groups():
	token = request.headers.get("token")
	if not token:
		token = request.headers.get("serviceToken")
		if not token:
			return "Missing token", 401
	whoami = check_token(token)
	if whoami is None:
		return "Access denied", 403
	if whoami["access"]["type"] == "user":
		meta_data = get_request_meta_data()
		url = f"{BACKEND_SERVICE_URL}/account/groups"
		response = requests.get(url, **meta_data)
		if response.status_code == 200:
			return jsonify(response.json()["data"]), 200
		return response.content, response.status_code
	if whoami["access"]["type"] == "group":
		group_id = whoami["access"]["id"]
		return v1_get_group(group_id)
	return "Unknown access type", 500
