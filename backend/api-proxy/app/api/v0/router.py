from flask.json import jsonify
from flask import request
import requests

from app import BACKEND_SERVICE_URL, AUTH_SERVICE_URL
from app.api_controller import route, version, Access
from app.status import ok
from app.processing.common_methods import get_request_meta_data
from variables import _at, _st


version("")


@route("auth", ["POST"])
def _authorize():
	meta_data = get_request_meta_data()
	url = f"{AUTH_SERVICE_URL}/login"
	if _st in meta_data["headers"].keys():
		meta_data["headers"][_at] = meta_data["headers"][_st]
	response = requests.post(url, **meta_data)
	return response.content, response.status_code


@route("check_access", ["GET"])
def _ping_pong():
	meta_data = get_request_meta_data()
	url = f"{AUTH_SERVICE_URL}/whoami"
	response = requests.get(url, **meta_data)
	return response.content, response.status_code


@route("groups", ["GET"])
def _get_groups():
	meta_data = get_request_meta_data()
	url = f"{BACKEND_SERVICE_URL}/account/groups"
	response = requests.get(url, **meta_data)
	if response.status_code == 200:
		return jsonify(response.json()["data"]), 200
	return response.content, response.status_code

