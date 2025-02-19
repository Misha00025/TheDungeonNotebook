from flask import Request, jsonify, request
import requests
from app import BACKEND_SERVICE_URL
from app.processing.common_methods import get_character_id, get_request_meta_data
from app.processing.request_parser import from_user, get_whoami
from .parser import get_group_id, get_user_id, from_bot, search_by_name
from app.status import accepted, created, ok, forbidden, not_found, bad_request, conflict


def br(method):
	return f"Bad Request: can't {method} item using parameter 'name'. Please, use 'item_id'"


def errs_response(errs):
	return  {"error": {
				"message": "Find incorrect field type",
				"fields": errs
			}}

def get_items(rq: Request):
	whoami = get_whoami(rq)
	if not whoami:
		return forbidden()
	meta_data = get_request_meta_data()
	if from_user(rq):
		group_id = get_group_id(rq)
		character_id = get_character_id(group_id, meta_data)
		if character_id is None:
			response = requests.Response()
			response.status_code = 404
			response.content = "Can't find character"
			return response, []
		url = f"{BACKEND_SERVICE_URL}/characters/{character_id}/items"			
	else:
		group_id = whoami["access"]["id"]
		url = f"{BACKEND_SERVICE_URL}/groups/{group_id}/items"
	response = requests.get(url, **meta_data)
	if response.status_code == 200:
		items = []
		i = 0
		for item in response.json()["data"]["items"]:
			if "id" in item:
				continue
			item["id"] = i
			items.append(item)
			i+=1
		return response, items
	return response, None


def gets(rq: Request):
	response, items = get_items(rq)
	if items is not None:
		return jsonify({"items":items}), 200
	return response.content, response.status_code

def get(rq: Request, item_id):
	response, items = get_items(rq)
	if items is not None:
		for item in items:
			if str(item["id"]) == str(item_id):
				return jsonify({item}), 200
		response = requests.Response()
		response.status_code = 404
		response.content = "Item not found"
	return response.content, response.status_code
	

def put(rq: Request, item_id):
	pass


def delete(rq: Request, item_id):
	pass


def post_add(rq: Request, item_id):
	pass
	

def post_new(rq: Request):
	pass
