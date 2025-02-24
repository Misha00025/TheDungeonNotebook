from flask import jsonify, request
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

def as_owner(user):
	return {
				"vk_id": user["id"],
				"first_name": user["first_name"],
				"last_name": user["last_name"],
				"photo": user["photo_link"]
			}

def get_owner(character, group):
	try:
		users = group["admins"] + group["users"]
		for user in users:
			if user["first_name"] + " " + user["last_name"] == character["name"]:
				owner = as_owner(user)
				return owner
		return None
	except Exception as e:
		print(e)
		return None

def parse_note_id(str_id: str):
	character_id, note_id = str_id.split(".")
	return character_id, note_id

def get_character_notes(character_id, group_id, owner):
	# try:
		meta_data = get_request_meta_data()
		url = f"{BACKEND_SERVICE_URL}/characters/{character_id}/notes"
		character = requests.get(url, **meta_data).json()["data"]
		notes = character["notes"]
		i = 0
		result = []
		for note in notes:
			res = {
				"id": str(character["id"]) + "." + str(i),
				"header": note["header"],
				"body": note["body"],
				"last_modify": note["modified_date"],
				"group_id":  group_id,
				"owner_id": character_id,
				"author": owner
			}
			i+=1
			result.append(res)
		return result
		
	# except Exception as e:
	# 	print(e)
	# 	return None


def get_notes():
	# try:
		meta_data = get_request_meta_data()
		group_id = get_group_id(rq)
		url = f"{BACKEND_SERVICE_URL}/groups/{group_id}/characters"
		res = requests.get(url, **meta_data).json()
		notes = None
		if res["access_level"] == "Admin":
			characters = res["data"]["characters"]
			notes = []
			for character in characters:
				owner = get_owner(character, res["data"])
				c_notes = get_character_notes(character["id"], group_id, owner)
				notes.extend(c_notes if c_notes is not None else [])
		else:
			character_id = get_character_id(group_id, meta_data)
			if character_id is None:
				return None
			url = f"{BACKEND_SERVICE_URL}/account"
			owner = as_owner(requests.get(url, **meta_data).json()["data"])
			notes = get_character_notes(character_id, group_id, owner)
		return notes
	# except Exception as e:
	# 	print(e)
	# 	return None


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
	character_id, note_id = parse_note_id(note_id)
	meta_data = get_request_meta_data()
	url = f"{BACKEND_SERVICE_URL}/characters/{character_id}/notes/{note_id}"
	res = requests.put(url, **meta_data)
	return res.content, res.status_code


def delete(note_id):
	whoami = get_whoami(rq)
	if not whoami:
		return forbidden()
	character_id, note_id = parse_note_id(note_id)
	meta_data = get_request_meta_data()
	url = f"{BACKEND_SERVICE_URL}/characters/{character_id}/notes/{note_id}"
	res = requests.delete(url, **meta_data)
	return res.content, res.status_code


def add():
	group_id = get_group_id(rq)
	user_id = get_user_id(rq)
	meta_data = get_request_meta_data(without_data=True)
	url = f"{BACKEND_SERVICE_URL}/groups/{group_id}/characters"
	res = requests.get(url, **meta_data).json()
	group = res["data"]
	if res["access_level"] == "Admin":
		characters = group["characters"]
		users = group["users"] + group["admins"]
		for user in users:
			if user_id == user["id"]:
				break 
		for character in characters:
			if character["name"] == user["first_name"] + " " + user["last_name"]:
				character_id = character["id"]
				break				
	else:
		character_id = get_character_id(group_id, meta_data)
	url = f"{BACKEND_SERVICE_URL}/characters/{character_id}/notes"
	res = requests.post(url, data=generate_note() **meta_data)
	notes = get_character_notes(character_id, group_id, None)
	last_id = notes[len(notes)-1]["id"]
	return created({"last_id": last_id})


def get_all():
	whoami = get_whoami(rq)
	if not whoami:
		return forbidden()
	notes = get_notes()
	print(notes)
	if notes is None:
		return not_found()
	return ok({"notes": notes})
	

