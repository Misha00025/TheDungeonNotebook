from flask import Request, jsonify, request
import requests
from app import BACKEND_SERVICE_URL
from app.processing.common_methods import check_token, get_request_meta_data
from app.processing.request_parser import from_user
from .parser import get_group_id, get_user_id, from_bot, search_by_name
from app.status import accepted, created, ok, forbidden, not_found, bad_request, conflict


def br(method):
	return f"Bad Request: can't {method} item using parameter 'name'. Please, use 'item_id'"


def errs_response(errs):
	return  {"error": {
				"message": "Find incorrect field type",
				"fields": errs
			}}


def gets(rq: Request):
	token = rq.headers.get("token")
	if not token:
		token = rq.headers.get("serviceToken")
		if not token:
			return "Missing token", 401
	whoami = check_token(token)
	if not whoami:
		return forbidden()
	meta_data = get_request_meta_data()
	if from_user(rq):
		group_id = get_group_id(rq)
		url = f"{BACKEND_SERVICE_URL}/groups/{group_id}/characters"
		response = requests.get(url, **meta_data)
		if response.status_code == 200:
			characters = response.json()["data"]["characters"]
			if len(characters) == 0:
				return ok({"items":[]})
			character_id = characters[0]["id"]
			url = f"{BACKEND_SERVICE_URL}/characters/{character_id}/items"			
	else:
		group_id = whoami["access"]["id"]
		url = f"{BACKEND_SERVICE_URL}/groups/{group_id}/items"
	response = requests.get(url, **meta_data)
	if response.status_code == 200:
		items = []
		i = 0
		for item in response.json()["data"]["items"]:
			item["id"] = i
			items.append(item)
			i+=1
		return jsonify({"items":items}), 200
	return response.content, response.status_code

def get(rq: Request, item_id):
	pass
	

def put(rq: Request, item_id):
	pass


def delete(rq: Request, item_id):
	pass


def post_add(rq: Request, item_id):
	pass
	

def post_new(rq: Request):
	pass
