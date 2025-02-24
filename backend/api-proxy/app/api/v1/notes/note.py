from flask import request
import requests
from app import BACKEND_SERVICE_URL
from app.processing.common_methods import get_character_id, get_request_meta_data
from app.processing.request_parser import *
from app.status import forbidden, not_found, accepted, not_implemented, ok, created

rq = request

def in_keys(k1, k2):
	for k in k1:
		if k not in k2:
			return False
	return True


def get_character_notes(character_id, group_id):
	try:
		meta_data = get_request_meta_data()
		url = f"{BACKEND_SERVICE_URL}/characters/{character_id}/notes"
		character = requests.get(url, **meta_data)["data"]
		notes = character["notes"]
		i = 0
		result = []
		for note in notes:
			res = {
				"id": character["id"] + "." + str(i),
				"header": note["header"],
				"body": note["body"],
				"last_modify": note["modified_date"],
				"group_id":  group_id,
				"owner_id": character_id,
				"author":{
					"vk_id": character["id"],
					"first_name": character["name"],
					"last_name": "",
					"photo": None
				}
			}
			i+=1
			result.append(res)
		return result
		
	except Exception as e:
		print(e)
		return None


def get_notes():
	meta_data = get_request_meta_data()
	group_id = get_group_id(rq)
	url = f"{BACKEND_SERVICE_URL}/groups/{group_id}/characters"
	res = requests.get(url, **meta_data)
	notes = None
	if res["access_level"] == "Admin":
		characters = res["data"]["characters"]
		notes = []
		for character in characters:
			c_notes = get_character_notes(character["id"], group_id)
			notes.extend(c_notes if c_notes is not None else [])
			# TODO: Add check of owner_id parameter
	else:
		character_id = get_character_id(group_id, meta_data)
		if character_id is None:
			return None
		notes = get_character_notes(character_id, group_id)
	return notes


def generate_note():
	note = {}
	js: dict = request.json
	hard_keys = ["header", "body"]
	if in_keys(hard_keys, js.keys()):
		note["header"] = js[hard_keys[0]]
		note["body"] = js[hard_keys[1]]
	else:
		return None
	return note


def get(note_id):
	whoami = get_whoami(rq)
	if not whoami:
		return forbidden()
	notes = get_notes()
	for note in notes:
		if str(note["id"]) == str(note_id):
			return ok(note)
	return not_found()
	

def put(note_id):
	whoami = get_whoami(rq)
	if not whoami:
		return forbidden()
	return not_implemented()


def delete(note_id):
	whoami = get_whoami(rq)
	if not whoami:
		return forbidden()
	return not_implemented()


def add():
	last_id = len([])
	return created({"last_id": last_id})


def get_all():
	whoami = get_whoami(rq)
	if not whoami:
		return forbidden()
	notes = get_notes()
	if notes is None:
		return not_found()
	return ok({"notes": notes})
	

